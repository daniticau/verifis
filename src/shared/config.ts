// Shared configuration for the Grok Live Search extension
// Reads environment variables with sensible defaults

export interface GrokConfig {
  apiKey: string;
  primaryModel: string;
  fastModel: string;
  allowedSites: string[];
  maxResults: number;
  fromDate: string;
  strictWhitelist: boolean;
}

// Default configuration values
const DEFAULT_CONFIG: Omit<GrokConfig, 'apiKey'> = {
  primaryModel: 'grok-4-fast-reasoning',
  fastModel: 'grok-2-1212', // Faster model for auto fact-checking
  allowedSites: ['nih.gov', 'who.int', 'nejm.org', 'jamanetwork.com'],
  maxResults: 6, // Reduced for faster processing
  fromDate: '2023-01-01',
  strictWhitelist: false
};

// Environment variable helpers
function getEnvVar(key: string, defaultValue: string = ''): string {
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
    if (stored) return stored;
  }
  return defaultValue;
}

function getEnvArray(key: string, defaultValue: string[] = []): string[] {
  const value = getEnvVar(key);
  if (!value) return defaultValue;
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = getEnvVar(key);
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = getEnvVar(key);
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

// Load configuration from environment
export function loadConfig(): GrokConfig {
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
export function validateConfig(config: GrokConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

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
export const config = loadConfig();
