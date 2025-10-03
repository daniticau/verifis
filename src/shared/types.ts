// TypeScript types for the Grok Live Search extension

export type Stance = 'supports' | 'refutes' | 'mixed';

export interface SourceCredibility {
  url: string;
  stance: Stance;
  evidence: string[];
  credibility: number;
}

export interface CredResult {
  summary: string;
  per_source: SourceCredibility[];
  overall_score: number;
}

export interface FactCheckResult {
  claim: string;
  overall: number;
  summary: string;
  sources: {
    url: string;
    domain: string;
    stance: Stance;
    credibility: number;
    evidence: string[];
  }[];
  raw?: any;
  processingTime?: number;
  model?: string;
}

export interface GrokSearchResponse {
  answer: string;
  citations: string[];
}

export interface FactCheckRequest {
  claim: string;
  pageUrl?: string;
  pageTitle?: string;
  useFastModel?: boolean;
}

export interface FactCheckResponse {
  success: boolean;
  result?: FactCheckResult;
  error?: string;
  cached?: boolean;
}

// Background script message types
export interface BackgroundMessage {
  type: 'FACT_CHECK_REQUEST' | 'FACT_CHECK_RESPONSE' | 'ERROR';
  payload?: any;
}

export interface FactCheckRequestMessage extends BackgroundMessage {
  type: 'FACT_CHECK_REQUEST';
  payload: FactCheckRequest;
}

export interface FactCheckResponseMessage extends BackgroundMessage {
  type: 'FACT_CHECK_RESPONSE';
  payload: FactCheckResponse;
}

export interface ErrorMessage extends BackgroundMessage {
  type: 'ERROR';
  payload: {
    message: string;
    code?: string;
  };
}

// Content script types
export interface SelectionContext {
  text: string;
  pageUrl: string;
  pageTitle: string;
  selectionRange?: {
    start: number;
    end: number;
  };
}

// Cache types
export interface CacheEntry {
  result: FactCheckResult;
  timestamp: number;
  hash: string;
}

export interface CacheStats {
  size: number;
  keys: string[];
  oldestEntry?: number;
  newestEntry?: number;
}

// Settings types
export interface ExtensionSettings {
  allowedSites: string[];
  maxResults: number;
  fromDate: string;
  strictWhitelist: boolean;
  fastPreviewEnabled: boolean;
  cacheEnabled: boolean;
  cacheExpiryMinutes: number;
  autoFactCheckEnabled: boolean;
  autoFactCheckDelay: number;
  minTextLength: number;
}

// Error types
export class GrokError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'GrokError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends GrokError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT', 429);
  }
}

export class APIKeyError extends GrokError {
  constructor(message: string = 'Invalid or missing API key') {
    super(message, 'API_KEY_ERROR', 401);
  }
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
