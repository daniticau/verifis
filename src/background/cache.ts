// Caching system for fact-check results
import { FactCheckResult, CacheEntry, CacheStats } from '../shared/types';

export class FactCheckCache {
  private readonly maxEntries = 10;
  private readonly defaultExpiryMinutes = 10;
  private cache = new Map<string, CacheEntry>();

  // Generate hash for claim text
  private hashClaim(claim: string): string {
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
  get(claim: string): FactCheckResult | null {
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
  set(claim: string, result: FactCheckResult): void {
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
    
    const entry: CacheEntry = {
      result,
      timestamp: Date.now(),
      hash
    };
    
    this.cache.set(hash, entry);
    console.log(`💾 Cached result for claim: "${claim.substring(0, 50)}..."`);
  }

  // Clear all cached entries
  clear(): void {
    this.cache.clear();
    console.log('🗑️ Cache cleared');
  }

  // Remove expired entries
  private cleanup(): void {
    const now = Date.now();
    const expiryTime = this.defaultExpiryMinutes * 60 * 1000;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > expiryTime) {
        this.cache.delete(key);
      }
    }
  }

  // Get oldest cache key
  private getOldestKey(): string | null {
    let oldestKey: string | null = null;
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
  getStats(): CacheStats {
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
  async loadFromStorage(): Promise<void> {
    try {
      const stored = await chrome.storage.session.get(['factCheckCache']);
      const cacheData = stored.factCheckCache;
      
      if (cacheData && typeof cacheData === 'object') {
        this.cache = new Map(Object.entries(cacheData));
        console.log(`📥 Loaded ${this.cache.size} entries from storage`);
      }
    } catch (error) {
      console.warn('Failed to load cache from storage:', error);
    }
  }

  // Save to Chrome storage
  async saveToStorage(): Promise<void> {
    try {
      const cacheData = Object.fromEntries(this.cache);
      await chrome.storage.session.set({ factCheckCache: cacheData });
      console.log(`💾 Saved ${this.cache.size} entries to storage`);
    } catch (error) {
      console.warn('Failed to save cache to storage:', error);
    }
  }
}

// Export singleton instance
export const factCheckCache = new FactCheckCache();
