/******/ (() => { // webpackBootstrap
/******/ 	"use strict";

// UNUSED EXPORTS: factCheckCache, factCheckService

;// ./src/shared/config.ts
// Shared configuration for the Grok Live Search extension
// Reads environment variables with sensible defaults
// Default configuration values
const DEFAULT_CONFIG = {
    primaryModel: 'grok-4-fast-reasoning',
    fastModel: 'grok-2-1212', // Faster model for auto fact-checking
    allowedSites: ['nih.gov', 'who.int', 'nejm.org', 'jamanetwork.com'],
    maxResults: 6, // Reduced for faster processing
    fromDate: '2023-01-01',
    strictWhitelist: false
};
// Environment variable helpers
function getEnvVar(key, defaultValue = '') {
    // For Node.js environment (backend)
    if (typeof process !== 'undefined' && process.env) {
        return process.env[key] || defaultValue;
    }
    // For browser environment (extension), try to get from Chrome storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
        // This will be handled asynchronously in the extension
        return defaultValue;
    }
    // Fallback to localStorage
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(`GROK_${key}`);
        if (stored)
            return stored;
    }
    return defaultValue;
}
function getEnvArray(key, defaultValue = []) {
    const value = getEnvVar(key);
    if (!value)
        return defaultValue;
    return value.split(',').map(s => s.trim()).filter(Boolean);
}
function getEnvNumber(key, defaultValue) {
    const value = getEnvVar(key);
    if (!value)
        return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}
function getEnvBoolean(key, defaultValue) {
    const value = getEnvVar(key);
    if (!value)
        return defaultValue;
    return value.toLowerCase() === 'true';
}
// Load configuration from environment
function loadConfig() {
    const apiKey = getEnvVar('XAI_API_KEY');
    if (!apiKey) {
        console.warn('XAI_API_KEY not found in environment variables');
    }
    return {
        apiKey,
        primaryModel: getEnvVar('GROK_MODEL_PRIMARY', DEFAULT_CONFIG.primaryModel),
        fastModel: getEnvVar('GROK_MODEL_FAST', DEFAULT_CONFIG.fastModel),
        allowedSites: getEnvArray('GROK_ALLOWED_SITES', DEFAULT_CONFIG.allowedSites),
        maxResults: getEnvNumber('GROK_MAX_RESULTS', DEFAULT_CONFIG.maxResults),
        fromDate: getEnvVar('GROK_FROM_DATE', DEFAULT_CONFIG.fromDate),
        strictWhitelist: getEnvBoolean('GROK_STRICT_WHITELIST', DEFAULT_CONFIG.strictWhitelist)
    };
}
// Validate configuration
function validateConfig(config) {
    const errors = [];
    if (!config.apiKey) {
        console.warn('⚠️ XAI_API_KEY not set - extension will work in demo mode');
        // Don't treat missing API key as an error for now
        // errors.push('XAI_API_KEY is required');
    }
    if (config.maxResults < 1 || config.maxResults > 20) {
        errors.push('GROK_MAX_RESULTS must be between 1 and 20');
    }
    if (config.fromDate && !/^\d{4}-\d{2}-\d{2}$/.test(config.fromDate)) {
        errors.push('GROK_FROM_DATE must be in YYYY-MM-DD format');
    }
    return {
        valid: errors.length === 0,
        errors
    };
}
// Export default config instance
const config = loadConfig();

;// ./src/shared/types.ts
// TypeScript types for the Grok Live Search extension
// Error types
class GrokError extends Error {
    constructor(message, code, statusCode) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.name = 'GrokError';
    }
}
class ValidationError extends Error {
    constructor(message, field) {
        super(message);
        this.field = field;
        this.name = 'ValidationError';
    }
}
class RateLimitError extends GrokError {
    constructor(message = 'Rate limit exceeded') {
        super(message, 'RATE_LIMIT', 429);
    }
}
class APIKeyError extends GrokError {
    constructor(message = 'Invalid or missing API key') {
        super(message, 'API_KEY_ERROR', 401);
    }
}

;// ./src/background/clients/grok.ts

class GrokClient {
    constructor(config) {
        this.baseUrl = 'https://api.x.ai/v1';
        this.requestCount = 0;
        this.lastRequestTime = 0;
        this.rateLimit = 3; // requests per window
        this.rateLimitWindow = 10000; // 10 seconds
        this.config = config;
    }
    // Rate limiting check
    checkRateLimit() {
        const now = Date.now();
        if (now - this.lastRequestTime > this.rateLimitWindow) {
            this.requestCount = 0;
            this.lastRequestTime = now;
        }
        if (this.requestCount >= this.rateLimit) {
            throw new RateLimitError('Rate limit exceeded. Please wait before making another request.');
        }
        this.requestCount++;
    }
    // Make authenticated request to Grok API
    async makeRequest(endpoint, body) {
        this.checkRateLimit();
        if (!this.config.apiKey) {
            throw new APIKeyError('XAI_API_KEY is required');
        }
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body)
            });
            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = `HTTP ${response.status}: ${errorText}`;
                if (response.status === 401) {
                    throw new APIKeyError('Invalid API key');
                }
                else if (response.status === 429) {
                    throw new RateLimitError('Rate limit exceeded');
                }
                else if (response.status >= 500) {
                    errorMessage = 'Server error. Please try again later.';
                }
                throw new GrokError(errorMessage, 'API_ERROR', response.status);
            }
            return await response.json();
        }
        catch (error) {
            if (error instanceof GrokError) {
                throw error;
            }
            throw new GrokError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'NETWORK_ERROR');
        }
    }
    // Search with Live Search enabled
    async search(claim, useFastModel = false) {
        const model = useFastModel ? this.config.fastModel : this.config.primaryModel;
        const body = {
            model,
            messages: [
                {
                    role: 'system',
                    content: 'You are a retrieval agent. Return concise evidence with citations. Focus on factual accuracy and provide clear, neutral analysis.'
                },
                {
                    role: 'user',
                    content: `Fact-check this claim in neutral terms and gather sources:\n\n${claim}\n\nReturn key points only with clear evidence.`
                }
            ],
            search_parameters: {
                mode: 'on',
                return_citations: true,
                max_search_results: useFastModel ? Math.min(4, this.config.maxResults) : this.config.maxResults, // Fewer results for fast model
                sources: [
                    {
                        type: 'web',
                        allowed_websites: this.config.allowedSites.length > 0 ? this.config.allowedSites : undefined
                    },
                    {
                        type: 'news',
                        country: 'US'
                    }
                ],
                from_date: this.config.fromDate
            },
            temperature: useFastModel ? 0.2 : 0.1, // Slightly higher temperature for faster processing
            max_tokens: useFastModel ? 800 : 2000 // Reduced tokens for faster processing
        };
        console.log(`🔍 Grok Search: Using ${model} for claim: "${claim.substring(0, 100)}..."`);
        const data = await this.makeRequest('/chat/completions', body);
        return {
            answer: data?.choices?.[0]?.message?.content ?? '',
            citations: data?.citations ?? []
        };
    }
    // Summarize and score evidence
    async summarizeAndScore(urls, claim, useFastModel = false) {
        const model = useFastModel ? this.config.fastModel : this.config.primaryModel;
        const rubric = useFastModel ? `
Summarize evidence in 80-120 words, then output JSON ONLY with:
- "summary": string (80-120 words)
- "per_source": array of {url, stance: supports|refutes|mixed, evidence: [1 short bullet], credibility: 0-100}
- "overall_score": 0-100 weighted by credibility

Quick credibility scoring (0-100):
1) Publisher reputation (30 points)
2) Direct evidence (40 points) 
3) Recency (30 points)

The claim to evaluate is: "${claim}"

URLs to analyze:
${urls.join('\n')}

Return ONLY the JSON object. No additional text.
    `.trim() : `
Summarize evidence across the provided URLs in 120–180 words, then output JSON ONLY with:
- "summary": string (120-180 words)
- "per_source": array of {url, stance: supports|refutes|mixed, evidence: [1-2 short bullets], credibility: 0-100}
- "overall_score": 0-100 weighted by credibility

Credibility scoring criteria (0-100):
1) Publisher reputation/editorial standards (20 points)
2) Direct evidence (data/methods/primary sources) (25 points)
3) Recency appropriate to topic (15 points)
4) Transparency (named authors/disclosures) (15 points)
5) Corroboration with other high-cred sources (25 points)

The claim to evaluate is: "${claim}"

URLs to analyze:
${urls.join('\n')}

Return ONLY the JSON object. No additional text.
    `.trim();
        const body = {
            model,
            messages: [
                {
                    role: 'system',
                    content: 'You are a careful evidence summarizer and credibility rater. Always return valid JSON.'
                },
                {
                    role: 'user',
                    content: rubric
                }
            ],
            temperature: useFastModel ? 0.2 : 0.1,
            max_tokens: useFastModel ? 1000 : 3000 // Reduced tokens for faster processing
        };
        console.log(`📊 Grok Summarize: Using ${model} for ${urls.length} sources`);
        const data = await this.makeRequest('/chat/completions', body);
        const content = data?.choices?.[0]?.message?.content;
        if (!content) {
            throw new GrokError('No response content from Grok API', 'EMPTY_RESPONSE');
        }
        return this.parseCredResult(content);
    }
    // Parse JSON response from Grok
    parseCredResult(content) {
        try {
            // Clean the content to extract JSON
            let jsonText = content.trim();
            // Find JSON boundaries
            const jsonStart = jsonText.indexOf('{');
            const jsonEnd = jsonText.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                jsonText = jsonText.substring(jsonStart, jsonEnd + 1);
            }
            const parsed = JSON.parse(jsonText);
            // Validate and clean the parsed data
            if (!parsed.summary || !Array.isArray(parsed.per_source) || typeof parsed.overall_score !== 'number') {
                throw new Error('Invalid JSON structure');
            }
            // Ensure credibility scores are within bounds
            parsed.per_source = parsed.per_source.map((source) => ({
                ...source,
                credibility: Math.max(0, Math.min(100, source.credibility || 50))
            }));
            parsed.overall_score = Math.max(0, Math.min(100, parsed.overall_score));
            return parsed;
        }
        catch (error) {
            console.error('Failed to parse Grok response:', content);
            throw new GrokError(`Failed to parse AI response: ${error instanceof Error ? error.message : 'Invalid JSON'}`, 'PARSE_ERROR');
        }
    }
    // Get client status
    getStatus() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest > this.rateLimitWindow) {
            return { rateLimitRemaining: this.rateLimit, lastRequestTime: this.lastRequestTime };
        }
        return {
            rateLimitRemaining: Math.max(0, this.rateLimit - this.requestCount),
            lastRequestTime: this.lastRequestTime
        };
    }
}

;// ./src/background/factCheck.ts
// Fact-checking service that orchestrates Grok Live Search and credibility scoring


class FactCheckService {
    constructor(config) {
        this.config = config;
        this.grokClient = new GrokClient(config);
    }
    // Main fact-checking method
    async factCheck(request) {
        const startTime = Date.now();
        try {
            // Validate input
            this.validateRequest(request);
            console.log(`🔍 Starting fact-check for: "${request.claim.substring(0, 100)}..."`);
            // Step 1: Search for evidence using Grok Live Search
            const searchResult = await this.grokClient.search(request.claim, request.useFastModel);
            if (!searchResult.citations || searchResult.citations.length === 0) {
                return {
                    success: false,
                    error: 'No sources found for this claim'
                };
            }
            console.log(`📚 Found ${searchResult.citations.length} sources`);
            // Step 2: Summarize and score the evidence
            const credResult = await this.grokClient.summarizeAndScore(searchResult.citations, request.claim, request.useFastModel);
            // Step 3: Transform to final result format
            const result = {
                claim: request.claim,
                overall: credResult.overall_score,
                summary: credResult.summary,
                sources: credResult.per_source.map(source => ({
                    url: source.url,
                    domain: this.extractDomain(source.url),
                    stance: source.stance,
                    credibility: source.credibility,
                    evidence: source.evidence
                })),
                processingTime: Date.now() - startTime,
                model: request.useFastModel ? this.config.fastModel : this.config.primaryModel
            };
            console.log(`✅ Fact-check completed in ${result.processingTime}ms`);
            console.log(`📊 Overall score: ${result.overall}/100`);
            return {
                success: true,
                result
            };
        }
        catch (error) {
            console.error('Fact-check failed:', error);
            if (error instanceof ValidationError) {
                return {
                    success: false,
                    error: error.message
                };
            }
            if (error instanceof GrokError) {
                return {
                    success: false,
                    error: error.message
                };
            }
            return {
                success: false,
                error: 'An unexpected error occurred during fact-checking'
            };
        }
    }
    // Validate fact-check request
    validateRequest(request) {
        if (!request.claim || request.claim.trim().length === 0) {
            throw new ValidationError('Claim text is required', 'claim');
        }
        if (request.claim.length > 2000) {
            throw new ValidationError('Claim text is too long (max 2000 characters)', 'claim');
        }
        if (request.pageUrl && !this.isValidUrl(request.pageUrl)) {
            throw new ValidationError('Invalid page URL', 'pageUrl');
        }
    }
    // Extract domain from URL
    extractDomain(url) {
        try {
            const domain = new URL(url).hostname.replace(/^www\./, '');
            return domain;
        }
        catch {
            return 'unknown';
        }
    }
    // Validate URL format
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        }
        catch {
            return false;
        }
    }
    // Get service status
    getStatus() {
        return {
            config: {
                primaryModel: this.config.primaryModel,
                fastModel: this.config.fastModel,
                allowedSites: this.config.allowedSites,
                maxResults: this.config.maxResults,
                fromDate: this.config.fromDate,
                strictWhitelist: this.config.strictWhitelist
            },
            grokStatus: this.grokClient.getStatus()
        };
    }
}

;// ./src/background/cache.ts
class FactCheckCache {
    constructor() {
        this.maxEntries = 10;
        this.defaultExpiryMinutes = 10;
        this.cache = new Map();
    }
    // Generate hash for claim text
    hashClaim(claim) {
        // Simple hash function for claim text
        let hash = 0;
        const normalizedClaim = claim.toLowerCase().trim();
        for (let i = 0; i < normalizedClaim.length; i++) {
            const char = normalizedClaim.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }
    // Get cached result
    get(claim) {
        const hash = this.hashClaim(claim);
        const entry = this.cache.get(hash);
        if (!entry) {
            return null;
        }
        // Check if expired
        const now = Date.now();
        const expiryTime = entry.timestamp + (this.defaultExpiryMinutes * 60 * 1000);
        if (now > expiryTime) {
            this.cache.delete(hash);
            return null;
        }
        console.log(`📋 Cache hit for claim: "${claim.substring(0, 50)}..."`);
        return entry.result;
    }
    // Store result in cache
    set(claim, result) {
        const hash = this.hashClaim(claim);
        // Clean up expired entries first
        this.cleanup();
        // If cache is full, remove oldest entry
        if (this.cache.size >= this.maxEntries) {
            const oldestKey = this.getOldestKey();
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }
        const entry = {
            result,
            timestamp: Date.now(),
            hash
        };
        this.cache.set(hash, entry);
        console.log(`💾 Cached result for claim: "${claim.substring(0, 50)}..."`);
    }
    // Clear all cached entries
    clear() {
        this.cache.clear();
        console.log('🗑️ Cache cleared');
    }
    // Remove expired entries
    cleanup() {
        const now = Date.now();
        const expiryTime = this.defaultExpiryMinutes * 60 * 1000;
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > expiryTime) {
                this.cache.delete(key);
            }
        }
    }
    // Get oldest cache key
    getOldestKey() {
        let oldestKey = null;
        let oldestTime = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (entry.timestamp < oldestTime) {
                oldestTime = entry.timestamp;
                oldestKey = key;
            }
        }
        return oldestKey;
    }
    // Get cache statistics
    getStats() {
        const entries = Array.from(this.cache.values());
        const timestamps = entries.map(e => e.timestamp);
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
            oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : undefined,
            newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : undefined
        };
    }
    // Load from Chrome storage
    async loadFromStorage() {
        try {
            const stored = await chrome.storage.session.get(['factCheckCache']);
            const cacheData = stored.factCheckCache;
            if (cacheData && typeof cacheData === 'object') {
                this.cache = new Map(Object.entries(cacheData));
                console.log(`📥 Loaded ${this.cache.size} entries from storage`);
            }
        }
        catch (error) {
            console.warn('Failed to load cache from storage:', error);
        }
    }
    // Save to Chrome storage
    async saveToStorage() {
        try {
            const cacheData = Object.fromEntries(this.cache);
            await chrome.storage.session.set({ factCheckCache: cacheData });
            console.log(`💾 Saved ${this.cache.size} entries to storage`);
        }
        catch (error) {
            console.warn('Failed to save cache to storage:', error);
        }
    }
}
// Export singleton instance
const factCheckCache = new FactCheckCache();

;// ./src/background/index.ts
// Background service worker for Grok Live Search fact-checking



// Initialize services
let factCheckService;
let isInitialized = false;
let currentConfig;
// Initialize the background service
async function initialize() {
    try {
        console.log('🚀 Initializing Verifis Background Service...');
        console.log('🔍 Debug: Background service starting...');
        // Load API key from Chrome storage
        const stored = await chrome.storage.sync.get(['XAI_API_KEY']);
        if (stored.XAI_API_KEY) {
            config.apiKey = stored.XAI_API_KEY;
            console.log('✅ API key loaded from Chrome storage');
        }
        else {
            console.warn('⚠️ No API key found in Chrome storage');
            console.warn('💡 Please set your XAI_API_KEY in the extension settings');
            // Don't return here - let it continue with empty API key for now
        }
        // Store current config
        currentConfig = { ...config };
        // Validate configuration
        const validation = validateConfig(currentConfig);
        if (!validation.valid) {
            console.error('❌ Configuration validation failed:', validation.errors);
            return;
        }
        // Initialize fact-check service
        factCheckService = new FactCheckService(currentConfig);
        // Load cache from storage
        await factCheckCache.loadFromStorage();
        // Set up context menu
        setupContextMenu();
        // Set up command handlers
        setupCommands();
        isInitialized = true;
        console.log('✅ Background service initialized successfully');
    }
    catch (error) {
        console.error('❌ Failed to initialize background service:', error);
    }
}
// Set up context menu
function setupContextMenu() {
    // Remove all existing context menus first
    chrome.contextMenus.removeAll(() => {
        // Create the context menu item
        chrome.contextMenus.create({
            id: 'fact-check-selection',
            title: 'Fact-check selection',
            contexts: ['selection']
        }, () => {
            // Check for errors (like duplicate ID)
            if (chrome.runtime.lastError) {
                console.warn('Context menu creation warning:', chrome.runtime.lastError.message);
            }
            else {
                console.log('✅ Context menu created successfully');
            }
        });
    });
}
// Set up keyboard commands
function setupCommands() {
    chrome.commands.onCommand.addListener((command) => {
        if (command === 'fact-check-selection') {
            handleFactCheckRequest();
        }
    });
}
// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'fact-check-selection' && tab?.id) {
        handleFactCheckRequest(tab.id);
    }
});
// Handle fact-check requests from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FACT_CHECK_REQUEST') {
        handleFactCheckMessage(message, sendResponse);
        return true; // Keep message channel open for async response
    }
    else if (message.type === 'SETTINGS_UPDATED') {
        handleSettingsUpdate(message.payload);
        return true;
    }
    else if (message.type === 'OPEN_POPUP') {
        handleOpenPopup();
        return true;
    }
});
// Handle fact-check message
async function handleFactCheckMessage(message, sendResponse) {
    try {
        console.log('🔍 Debug: Received fact-check message:', message.payload);
        if (!isInitialized) {
            console.error('🔍 Debug: Background service not initialized');
            throw new Error('Background service not initialized');
        }
        const request = message.payload;
        console.log('🔍 Debug: Processing fact-check request:', request);
        const response = await processFactCheckRequest(request);
        console.log('🔍 Debug: Fact-check response:', response);
        sendResponse({
            type: 'FACT_CHECK_RESPONSE',
            payload: response
        });
    }
    catch (error) {
        console.error('🔍 Debug: Error handling fact-check message:', error);
        sendResponse({
            type: 'ERROR',
            payload: {
                message: error instanceof Error ? error.message : 'Unknown error',
                code: 'MESSAGE_HANDLER_ERROR'
            }
        });
    }
}
// Handle fact-check request from context menu or command
async function handleFactCheckRequest(tabId) {
    try {
        if (!tabId) {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            tabId = activeTab?.id;
        }
        if (!tabId) {
            throw new Error('No active tab found');
        }
        // Inject content script to get selection
        await chrome.scripting.executeScript({
            target: { tabId },
            func: getSelectedText
        });
    }
    catch (error) {
        console.error('Error handling fact-check request:', error);
    }
}
// Function to inject into content script
function getSelectedText() {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    if (!selectedText) {
        alert('Please select some text to fact-check');
        return;
    }
    // Send message to background script
    chrome.runtime.sendMessage({
        type: 'FACT_CHECK_REQUEST',
        payload: {
            claim: selectedText,
            pageUrl: window.location.href,
            pageTitle: document.title
        }
    });
}
// Process fact-check request
async function processFactCheckRequest(request) {
    try {
        console.log('🔍 Debug: Processing fact-check request for:', request.claim.substring(0, 50) + '...');
        // Ensure API key is loaded before processing
        console.log('🔍 Debug: Ensuring API key is loaded...');
        await ensureApiKeyLoaded();
        console.log('🔍 Debug: API key loaded successfully');
        // Check cache first
        console.log('🔍 Debug: Checking cache...');
        const cachedResult = factCheckCache.get(request.claim);
        if (cachedResult) {
            console.log('🔍 Debug: Using cached result');
            return {
                success: true,
                result: cachedResult,
                cached: true
            };
        }
        console.log('🔍 Debug: No cached result, processing with Grok...');
        // Process with Grok
        console.log('🔍 Debug: Calling factCheckService.factCheck...');
        const response = await factCheckService.factCheck(request);
        console.log('🔍 Debug: Grok response:', response);
        // Cache successful results
        if (response.success && response.result) {
            console.log('🔍 Debug: Caching successful result');
            factCheckCache.set(request.claim, response.result);
            await factCheckCache.saveToStorage();
            // Store auto fact-check result for popup display
            if (request.useFastModel) {
                console.log('🔍 Debug: Storing auto fact-check result for popup');
                const resultWithTimestamp = {
                    ...response.result,
                    timestamp: Date.now()
                };
                await chrome.storage.local.set({
                    lastAutoFactCheckResult: resultWithTimestamp
                });
                console.log('🔍 Debug: Stored auto fact-check result with timestamp:', resultWithTimestamp.timestamp);
                // Notify popup if it's open
                try {
                    chrome.runtime.sendMessage({
                        type: 'AUTO_FACT_CHECK_RESULT',
                        payload: resultWithTimestamp
                    });
                }
                catch (error) {
                    console.log('🔍 Debug: Popup not open, result stored for later');
                }
            }
        }
        return response;
    }
    catch (error) {
        console.error('🔍 Debug: Error processing fact-check request:', error);
        console.error('🔍 Debug: Error details:', {
            name: error instanceof Error ? error.name : 'Unknown',
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : 'No stack trace'
        });
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('🎉 Verifis extension installed');
        initialize();
    }
    else if (details.reason === 'update') {
        console.log('🔄 Verifis extension updated');
        initialize();
    }
});
// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
    console.log('🚀 Verifis extension startup');
    initialize();
});
// Ensure API key is loaded from storage
async function ensureApiKeyLoaded() {
    try {
        // Check if we already have an API key
        if (currentConfig && currentConfig.apiKey) {
            return; // API key already loaded
        }
        console.log('🔍 Debug: Loading API key from storage...');
        const stored = await chrome.storage.sync.get(['XAI_API_KEY']);
        if (stored.XAI_API_KEY) {
            if (!currentConfig) {
                currentConfig = { ...config };
            }
            currentConfig.apiKey = stored.XAI_API_KEY;
            console.log('✅ API key loaded from storage');
            // Reinitialize fact-check service with loaded config
            factCheckService = new FactCheckService(currentConfig);
            console.log('✅ Fact-check service reinitialized with API key');
        }
        else {
            console.warn('⚠️ No API key found in Chrome storage');
            throw new Error('XAI_API_KEY is required. Please set your API key in the extension settings.');
        }
    }
    catch (error) {
        console.error('Failed to load API key:', error);
        throw error;
    }
}
// Handle settings update
async function handleSettingsUpdate(settings) {
    try {
        console.log('🔍 Debug: Settings updated, reloading config...');
        // Reload API key from storage
        const stored = await chrome.storage.sync.get(['XAI_API_KEY']);
        if (stored.XAI_API_KEY) {
            currentConfig.apiKey = stored.XAI_API_KEY;
            console.log('✅ API key updated from settings');
            // Reinitialize fact-check service with new config
            factCheckService = new FactCheckService(currentConfig);
            console.log('✅ Fact-check service reinitialized');
        }
    }
    catch (error) {
        console.error('Failed to update settings:', error);
    }
}
// Handle open popup request
function handleOpenPopup() {
    try {
        console.log('🔍 Debug: Opening extension popup...');
        chrome.action.openPopup();
    }
    catch (error) {
        console.error('Failed to open popup:', error);
    }
}
// Initialize on service worker startup
initialize();
// Export for testing


/******/ })()
;