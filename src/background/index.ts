// Background service worker for Grok Live Search fact-checking
import { config, validateConfig, GrokConfig } from '../shared/config';
import { FactCheckService } from './factCheck';
import { factCheckCache } from './cache';
import { 
  FactCheckRequest, 
  FactCheckResponse,
  BackgroundMessage,
  FactCheckRequestMessage,
  FactCheckResponseMessage,
  ErrorMessage
} from '../shared/types';

// Initialize services
let factCheckService: FactCheckService;
let isInitialized = false;
let currentConfig: GrokConfig;

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
    } else {
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
    
  } catch (error) {
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
      } else {
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
chrome.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) => {
  if (message.type === 'FACT_CHECK_REQUEST') {
    handleFactCheckMessage(message as FactCheckRequestMessage, sendResponse);
    return true; // Keep message channel open for async response
  } else if (message.type === 'SETTINGS_UPDATED') {
    handleSettingsUpdate(message.payload);
    return true;
  } else if (message.type === 'OPEN_POPUP') {
    handleOpenPopup();
    return true;
  }
});

// Handle fact-check message
async function handleFactCheckMessage(
  message: FactCheckRequestMessage, 
  sendResponse: (response: FactCheckResponseMessage | ErrorMessage) => void
) {
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
    
  } catch (error) {
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
async function handleFactCheckRequest(tabId?: number) {
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
    
  } catch (error) {
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
async function processFactCheckRequest(request: FactCheckRequest): Promise<FactCheckResponse> {
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
        } catch (error) {
          console.log('🔍 Debug: Popup not open, result stored for later');
        }
      }
    }
    
    return response;
    
  } catch (error) {
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
  } else if (details.reason === 'update') {
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
    } else {
      console.warn('⚠️ No API key found in Chrome storage');
      throw new Error('XAI_API_KEY is required. Please set your API key in the extension settings.');
    }
  } catch (error) {
    console.error('Failed to load API key:', error);
    throw error;
  }
}

// Handle settings update
async function handleSettingsUpdate(settings: any) {
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
  } catch (error) {
    console.error('Failed to update settings:', error);
  }
}


// Handle open popup request
function handleOpenPopup() {
  try {
    console.log('🔍 Debug: Opening extension popup...');
    chrome.action.openPopup();
  } catch (error) {
    console.error('Failed to open popup:', error);
  }
}

// Initialize on service worker startup
initialize();

// Export for testing
export { factCheckService, factCheckCache };
