import QuickLRU from 'quick-lru';

// Types for fetched pages
export interface FetchedPage {
  url: string;
  title: string;
  text: string;
  html: string;
  status: number;
  contentType: string;
  timestamp: number;
}

// Cache for fetched pages (5-15 min TTL)
const pageCache = new QuickLRU<string, FetchedPage>({
  maxSize: 500,
  maxAge: 15 * 60 * 1000, // 15 minutes
});

// Configuration
const FETCH_CONFIG = {
  timeout: 10000, // 10 seconds
  maxRetries: 2,
  userAgent: 'Verifis/0.1 (+https://verifis.app)',
  maxContentLength: 5 * 1024 * 1024, // 5MB
  allowedContentTypes: [
    'text/html',
    'application/xhtml+xml',
    'text/plain'
  ]
};

// Rate limiting (simple in-memory)
const rateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = {
  maxRequests: 10,
  windowMs: 60 * 1000 // 1 minute
};

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimit.get(ip);
  
  if (!limit || now > limit.resetTime) {
    rateLimit.set(ip, { count: 1, resetTime: now + RATE_LIMIT.windowMs });
    return true;
  }
  
  if (limit.count >= RATE_LIMIT.maxRequests) {
    return false;
  }
  
  limit.count++;
  return true;
}

// Fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': FETCH_CONFIG.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        ...options.headers
      }
    });
    
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Main fetch function with retries
export async function fetchPage(url: string, clientIP?: string): Promise<FetchedPage> {
  // Check cache first
  const cacheKey = `page:${url}`;
  const cached = pageCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 min TTL
    return cached;
  }

  // Check rate limit
  if (clientIP && !checkRateLimit(clientIP)) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= FETCH_CONFIG.maxRetries; attempt++) {
    try {
      // Add delay between retries
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }

      const response = await fetchWithTimeout(url, {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store'
      }, FETCH_CONFIG.timeout);

      // Check content type
      const contentType = response.headers.get('content-type') || '';
      if (!FETCH_CONFIG.allowedContentTypes.some(type => contentType.includes(type))) {
        throw new Error(`Unsupported content type: ${contentType}`);
      }

      // Check content length
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > FETCH_CONFIG.maxContentLength) {
        throw new Error('Content too large');
      }

      // Get HTML content
      const html = await response.text();
      
      if (html.length > FETCH_CONFIG.maxContentLength) {
        throw new Error('Content too large');
      }

      // Extract title from HTML
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : 'No title';

      // Extract text content (basic, will be enhanced by readability)
      const textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 10000); // Limit to 10k chars for basic text

      const fetchedPage: FetchedPage = {
        url,
        title,
        text: textContent,
        html,
        status: response.status,
        contentType,
        timestamp: Date.now()
      };

      // Cache the result
      pageCache.set(cacheKey, fetchedPage);
      
      return fetchedPage;

    } catch (error) {
      lastError = error as Error;
      console.warn(`Fetch attempt ${attempt + 1} failed for ${url}:`, error);
      
      // Don't retry on certain errors
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.warn('Request timeout, retrying...');
        } else if (error.message.includes('Unsupported content type')) {
          throw error; // Don't retry content type errors
        } else if (error.message.includes('Content too large')) {
          throw error; // Don't retry size errors
        }
      }
    }
  }

  throw new Error(`Failed to fetch page after ${FETCH_CONFIG.maxRetries + 1} attempts: ${lastError?.message}`);
}

// Batch fetch multiple pages
export async function fetchPages(urls: string[], clientIP?: string): Promise<FetchedPage[]> {
  const results: FetchedPage[] = [];
  const errors: string[] = [];

  // Fetch pages concurrently with concurrency limit
  const concurrencyLimit = 3;
  const chunks = [];
  
  for (let i = 0; i < urls.length; i += concurrencyLimit) {
    chunks.push(urls.slice(i, i + concurrencyLimit));
  }

  for (const chunk of chunks) {
    const promises = chunk.map(async (url) => {
      try {
        return await fetchPage(url, clientIP);
      } catch (error) {
        errors.push(`${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return null;
      }
    });

    const chunkResults = await Promise.all(promises);
    results.push(...chunkResults.filter(Boolean) as FetchedPage[]);
  }

  if (errors.length > 0) {
    console.warn('Some pages failed to fetch:', errors);
  }

  return results;
}

// Utility function to get domain from URL
export function getDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

// Utility function to check if URL is valid
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
