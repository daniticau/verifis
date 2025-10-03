// Simplified Grok-Only Search System
// Replaces all external search APIs with Grok's comprehensive knowledge and reasoning

import { grokSearchProvider, GrokSearchResult } from './grok-search';

// Simplified types for Grok-only search results
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: 'grok';
  score: number;
  reasoning?: string;
}

export interface SearchProvider {
  name: string;
  search(query: string): Promise<SearchResult[]>;
}

// Simple cache for Grok search results (5 min TTL for faster updates)
const searchCache = new Map<string, { results: SearchResult[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Grok Search Provider (the only provider we need)
class GrokSearchProvider implements SearchProvider {
  name = 'grok';

  async search(query: string): Promise<SearchResult[]> {
    // Check cache first
    const cacheKey = `grok:${query}`;
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`📋 Using cached Grok results for: "${query}"`);
      return cached.results;
    }

    try {
      console.log(`🔍 Grok Search: Processing query "${query}"`);
      const results = await grokSearchProvider.search(query);
      
      // Cache the results
      searchCache.set(cacheKey, { results, timestamp: Date.now() });
      
      console.log(`✅ Grok Search: Generated ${results.length} results for "${query}"`);
      return results;
    } catch (error) {
      console.error('Grok search error:', error);
      throw error;
    }
  }
}

// Simplified Search Orchestrator - Grok Only
export class SearchOrchestrator {
  private provider: GrokSearchProvider;

  constructor() {
    this.provider = new GrokSearchProvider();
    console.log('🚀 Grok-Only Search Orchestrator initialized');
    console.log('📋 Using Grok AI for all search and fact-checking operations');
  }

  async search(query: string): Promise<SearchResult[]> {
    return await this.provider.search(query);
  }

  async multiSearch(queries: string[]): Promise<SearchResult[]> {
    console.log(`🔍 Grok Multi-Search: Processing ${queries.length} queries`);
    
    try {
      const results = await grokSearchProvider.multiSearch(queries);
      console.log(`✅ Grok Multi-Search: Generated ${results.length} comprehensive analyses`);
      return results;
    } catch (error) {
      console.error('Grok multi-search error:', error);
      throw error;
    }
  }

  // Clear cache (useful for testing or when you want fresh results)
  clearCache(): void {
    searchCache.clear();
    console.log('🗑️ Grok search cache cleared');
  }

  // Get cache stats
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: searchCache.size,
      keys: Array.from(searchCache.keys())
    };
  }
}

// Export singleton instance
export const searchOrchestrator = new SearchOrchestrator();
