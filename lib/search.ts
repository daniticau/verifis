import QuickLRU from 'quick-lru';

// Types for search results
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: 'bing' | 'google' | 'brave' | 'duckduckgo' | 'wikipedia';
  score: number;
}

export interface SearchProvider {
  name: string;
  search(query: string): Promise<SearchResult[]>;
}

// Cache for search results (10-30 min TTL)
const searchCache = new QuickLRU<string, { results: SearchResult[]; timestamp: number }>({
  maxSize: 1000,
  maxAge: 30 * 60 * 1000, // 30 minutes
});

// Bing Search API (Primary)
class BingSearchProvider implements SearchProvider {
  name = 'bing';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.BING_API_KEY || '';
  }

  async search(query: string): Promise<SearchResult[]> {
    if (!this.apiKey) {
      throw new Error('Bing API key not configured');
    }

    try {
      const response = await fetch(
        `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=10&mkt=en-US`,
        {
          headers: {
            'Ocp-Apim-Subscription-Key': this.apiKey,
            'User-Agent': 'Verifis/0.1 (+https://verifis.app)'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Bing search failed: HTTP ${response.status}`);
      }

      const data = await response.json();
      
      return (data.webPages?.value || []).map((item: any, index: number) => ({
        title: item.name,
        url: item.url,
        snippet: item.snippet,
        source: 'bing' as const,
        score: 1.0 - (index * 0.1) // Higher score for top results
      }));
    } catch (error) {
      console.error('Bing search error:', error);
      throw error;
    }
  }
}

// Google Custom Search Engine
class GoogleSearchProvider implements SearchProvider {
  name = 'google';
  private apiKey: string;
  private searchEngineId: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_CSE_KEY || '';
    this.searchEngineId = process.env.GOOGLE_CSE_ID || '';
  }

  async search(query: string): Promise<SearchResult[]> {
    if (!this.apiKey || !this.searchEngineId) {
      throw new Error('Google CSE not configured');
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/customsearch/v1?key=${this.apiKey}&cx=${this.searchEngineId}&q=${encodeURIComponent(query)}&num=10`,
        {
          headers: {
            'User-Agent': 'Verifis/0.1 (+https://verifis.app)'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Google search failed: HTTP ${response.status}`);
      }

      const data = await response.json();
      
      return (data.items || []).map((item: any, index: number) => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        source: 'google' as const,
        score: 1.0 - (index * 0.1)
      }));
    } catch (error) {
      console.error('Google search error:', error);
      throw error;
    }
  }
}

// Brave Search API
class BraveSearchProvider implements SearchProvider {
  name = 'brave';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.BRAVE_API_KEY || '';
  }

  async search(query: string): Promise<SearchResult[]> {
    if (!this.apiKey) {
      console.warn('Brave API key not found in environment variables - skipping Brave search');
      return [];
    }

    try {
      console.log(`Brave Search: Querying "${query}"`);
      const response = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`,
        {
          headers: {
            'Accept': 'application/json',
            'X-Subscription-Token': this.apiKey,
            'User-Agent': 'Verifis/0.1 (+https://verifis.app)'
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Brave API Error: ${response.status} - ${errorText}`);
        throw new Error(`Brave search failed: HTTP ${response.status}`);
      }

      const data = await response.json();
      const results = (data.web?.results || []).map((item: any, index: number) => ({
        title: item.title,
        url: item.url,
        snippet: item.description,
        source: 'brave' as const,
        score: 1.0 - (index * 0.05) // Higher base scores for Brave (premium API)
      }));

      console.log(`Brave Search: Found ${results.length} results`);
      return results;
    } catch (error) {
      console.error('Brave search error:', error);
      throw error;
    }
  }
}

// Wikipedia Search (Free alternative)
class WikipediaProvider implements SearchProvider {
  name = 'wikipedia';

  async search(query: string): Promise<SearchResult[]> {
    try {
      // Use Wikipedia's opensearch API instead
      const searchResponse = await fetch(
        `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=5&namespace=0&format=json`,
        {
          headers: {
            'User-Agent': 'Verifis/0.1 (+https://verifis.app)'
          }
        }
      );

      if (!searchResponse.ok) {
        throw new Error(`Wikipedia search failed: HTTP ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();
      const results: SearchResult[] = [];

      // Parse opensearch response: [query, [titles], [descriptions], [urls]]
      if (Array.isArray(searchData) && searchData.length >= 4) {
        const titles = searchData[1] || [];
        const descriptions = searchData[2] || [];
        const urls = searchData[3] || [];

        for (let i = 0; i < titles.length; i++) {
          if (titles[i] && descriptions[i]) {
            results.push({
              title: titles[i],
              url: urls[i] || `https://en.wikipedia.org/wiki/${encodeURIComponent(titles[i].replace(/ /g, '_'))}`,
              snippet: descriptions[i],
              source: 'wikipedia' as const,
              score: 0.7 - (i * 0.1)
            });
          }
        }
      }

      console.log(`Wikipedia: Found ${results.length} results`);
      return results;
    } catch (error) {
      console.error('Wikipedia search error:', error);
      return [];
    }
  }
}

// DuckDuckGo Instant Answer (Improved)
class DuckDuckGoProvider implements SearchProvider {
  name = 'duckduckgo';

  async search(query: string): Promise<SearchResult[]> {
    try {
      const response = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
        {
          headers: {
            'User-Agent': 'Verifis/0.1 (+https://verifis.app)'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`DuckDuckGo search failed: HTTP ${response.status}`);
      }

      const data = await response.json();
      const results: SearchResult[] = [];
      
      // Add Abstract if available
      if (data.Abstract && data.Abstract.length > 20) {
        results.push({
          title: data.AbstractSource || data.Heading || 'DuckDuckGo Abstract',
          url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
          snippet: data.Abstract,
          source: 'duckduckgo' as const,
          score: 0.8
        });
      }

      // Add Definition if available
      if (data.Definition && data.Definition.length > 20) {
        results.push({
          title: data.DefinitionSource || 'Definition',
          url: data.DefinitionURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
          snippet: data.Definition,
          source: 'duckduckgo' as const,
          score: 0.7
        });
      }

      // Add Related Topics
      if (data.RelatedTopics && data.RelatedTopics.length > 0) {
        data.RelatedTopics.slice(0, 3).forEach((topic: any, index: number) => {
          if (topic.Text && topic.Text.length > 20) {
            results.push({
              title: topic.Text.substring(0, 80) + '...',
              url: topic.FirstURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
              snippet: topic.Text,
              source: 'duckduckgo' as const,
              score: 0.6 - (index * 0.1)
            });
          }
        });
      }

      // Add Answer if available
      if (data.Answer && data.Answer.length > 10) {
        results.push({
          title: data.AnswerType || 'Direct Answer',
          url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
          snippet: data.Answer,
          source: 'duckduckgo' as const,
          score: 0.9
        });
      }

      // If no results found, create a fallback result
      if (results.length === 0) {
        console.warn(`DuckDuckGo: No structured results for "${query}", creating fallback`);
        results.push({
          title: `Search "${query}" on DuckDuckGo`,
          url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
          snippet: `Click to search for "${query}" on DuckDuckGo to verify this information manually.`,
          source: 'duckduckgo' as const,
          score: 0.2
        });
      }

      console.log(`DuckDuckGo: Found ${results.length} results`);
      return results;
    } catch (error) {
      console.error('DuckDuckGo search error:', error);
      // Always return at least one fallback result
      return [{
        title: `Search "${query}" on DuckDuckGo`,
        url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        snippet: `Click to search for "${query}" on DuckDuckGo to verify this information manually.`,
        source: 'duckduckgo' as const,
        score: 0.1
      }];
    }
  }
}

// Main search orchestrator
export class SearchOrchestrator {
  private providers: SearchProvider[] = [];
  private fallbackProvider: SearchProvider;

  constructor() {
    // Initialize providers in priority order for fallback system
    if (process.env.BRAVE_API_KEY) {
      console.log('✅ Brave API key detected, adding Brave Search provider (highest priority)');
      this.providers.push(new BraveSearchProvider());
    } else {
      console.warn('❌ Brave API key not found in environment');
    }
    
    // Add DuckDuckGo as second priority (free, reliable fallback)
    this.providers.push(new DuckDuckGoProvider());
    
    // Add Wikipedia as third priority (free, knowledge-based fallback)
    this.providers.push(new WikipediaProvider());
    
    // Add other premium providers as additional options (not part of main fallback chain)
    if (process.env.BING_API_KEY) {
      console.log('✅ Bing API key detected (additional provider)');
      this.providers.push(new BingSearchProvider());
    }
    
    if (process.env.GOOGLE_CSE_KEY && process.env.GOOGLE_CSE_ID) {
      console.log('✅ Google CSE detected (additional provider)');
      this.providers.push(new GoogleSearchProvider());
    }

    console.log(`🔍 Search providers initialized in priority order: ${this.providers.map(p => p.name).join(' → ')}`);
    console.log('📋 STRICT Fallback chain: Brave (ALWAYS when available) → DuckDuckGo (only when Brave fails) → Wikipedia (absolute last resort)');

    // Use DuckDuckGo as final fallback (though it's already in the main chain)
    this.fallbackProvider = new DuckDuckGoProvider();
  }

  async search(query: string): Promise<SearchResult[]> {
    // Check cache first
    const cacheKey = `search:${query}`;
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) { // 10 min TTL
      return cached.results;
    }

    // Try providers in priority order with fallback
    let results: SearchResult[] = [];

    // 1. ALWAYS try Brave first - if it works, use ONLY Brave results
    const braveProvider = this.providers.find(p => p.name === 'brave');
    if (braveProvider) {
      try {
        console.log('🎯 ALWAYS trying Brave Search first...');
        results = await braveProvider.search(query);
        if (results.length > 0) {
          console.log(`✅ Brave returned ${results.length} results - using ONLY Brave results (no fallbacks)`);
          console.log(`🎯 Caching ${results.length} Brave results for query: "${query}"`);
          const finalResults = results.slice(0, 5); // Limit to top 5 Brave results
          searchCache.set(cacheKey, { results: finalResults, timestamp: Date.now() });
          return finalResults;
        } else {
          console.log('⚠️ Brave returned 0 results - falling back to DuckDuckGo');
        }
      } catch (error) {
        console.warn('❌ Brave search failed completely - falling back to DuckDuckGo:', error);
      }
    }

    // 2. Only try DuckDuckGo if Brave completely failed or returned 0 results
    const duckduckgoProvider = this.providers.find(p => p.name === 'duckduckgo');
    if (duckduckgoProvider) {
      try {
        console.log('🦆 Trying DuckDuckGo as fallback (Brave failed or returned 0 results)...');
        results = await duckduckgoProvider.search(query);
        if (results.length > 0) {
          console.log(`✅ DuckDuckGo returned ${results.length} results - using these (no Wikipedia)`);
          const finalResults = results.slice(0, 3); // Limit to top 3 DuckDuckGo results
          searchCache.set(cacheKey, { results: finalResults, timestamp: Date.now() });
          return finalResults;
        } else {
          console.log('⚠️ DuckDuckGo returned 0 results - falling back to Wikipedia as last resort');
        }
      } catch (error) {
        console.warn('❌ DuckDuckGo search failed completely - falling back to Wikipedia as last resort:', error);
      }
    }

    // 3. Only try Wikipedia if BOTH Brave AND DuckDuckGo completely failed
    const wikipediaProvider = this.providers.find(p => p.name === 'wikipedia');
    if (wikipediaProvider) {
      try {
        console.log('📚 Trying Wikipedia as ABSOLUTE LAST RESORT (both Brave and DuckDuckGo failed)...');
        results = await wikipediaProvider.search(query);
        if (results.length > 0) {
          console.log(`✅ Wikipedia returned ${results.length} results - using these as final fallback`);
          const finalResults = results.slice(0, 3); // Limit to top 3 Wikipedia results
          searchCache.set(cacheKey, { results: finalResults, timestamp: Date.now() });
          return finalResults;
        }
      } catch (error) {
        console.warn('❌ Wikipedia search failed:', error);
      }
    }

    // If all providers fail, return empty array
    console.warn('❌ ALL search providers failed for query:', query);
    return [];
  }

  async multiSearch(queries: string[]): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];
    let hasBraveResults = false;
    
    // First pass: try to get Brave results for all queries
    for (const query of queries) {
      try {
        const results = await this.search(query);
        if (results.length > 0) {
          // Check if any of these results are from Brave
          const braveResults = results.filter(r => r.source === 'brave');
          if (braveResults.length > 0) {
            hasBraveResults = true;
            console.log(`🎯 Brave returned ${braveResults.length} results for query "${query}" - prioritizing Brave`);
          }
          allResults.push(...results);
        }
      } catch (error) {
        console.warn(`Search failed for query "${query}":`, error);
      }
    }
    
    // If we have Brave results, filter to ONLY Brave results
    if (hasBraveResults) {
      console.log('🎯 Filtering to ONLY Brave results (no mixing with other providers)');
      const braveOnlyResults = allResults.filter(r => r.source === 'brave');
      
      // Deduplicate Brave results by URL and sort by score
      const uniqueBraveResults = new Map<string, SearchResult>();
      for (const result of braveOnlyResults) {
        if (!uniqueBraveResults.has(result.url) || uniqueBraveResults.get(result.url)!.score < result.score) {
          uniqueBraveResults.set(result.url, result);
        }
      }
      
      return Array.from(uniqueBraveResults.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 10); // Return top 10 unique Brave results
    }
    
    // If no Brave results, proceed with mixed results (DuckDuckGo + Wikipedia fallback)
    console.log('🔄 No Brave results found, using mixed provider results');
    
    // Deduplicate by URL and sort by score
    const uniqueResults = new Map<string, SearchResult>();
    for (const result of allResults) {
      if (!uniqueResults.has(result.url) || uniqueResults.get(result.url)!.score < result.score) {
        uniqueResults.set(result.url, result);
      }
    }

    return Array.from(uniqueResults.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Return top 10 unique results
  }
}

// Export singleton instance
export const searchOrchestrator = new SearchOrchestrator();
