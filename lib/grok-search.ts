// Grok-Only Search Provider
// Replaces all external search APIs with Grok's knowledge and reasoning capabilities

import { createOpenAI } from "@ai-sdk/openai";

export interface GrokSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: 'grok';
  score: number;
  reasoning?: string;
}

export interface GrokSearchProvider {
  search(query: string): Promise<GrokSearchResult[]>;
  multiSearch(queries: string[]): Promise<GrokSearchResult[]>;
}

class GrokSearchProviderImpl implements GrokSearchProvider {
  private client: any;
  private isConfigured: boolean = false;

  constructor() {
    const apiKey = process.env.XAI_API_KEY;
    if (apiKey) {
      this.client = createOpenAI({ 
        apiKey,
        baseURL: 'https://api.x.ai/v1'
      });
      this.isConfigured = true;
      console.log('✅ Grok Search Provider initialized');
    } else {
      console.warn('❌ XAI_API_KEY not found - Grok Search Provider disabled');
    }
  }

  async search(query: string): Promise<GrokSearchResult[]> {
    if (!this.isConfigured) {
      throw new Error('Grok API not configured - XAI_API_KEY missing');
    }

    try {
      console.log(`🔍 Grok Search: Analyzing query "${query}"`);
      
      const prompt = `
You are an expert fact-checker and information analyst. Given the search query below, provide a comprehensive analysis with relevant information sources.

Query: "${query}"

Please provide:
1. A direct answer or analysis of the query
2. Key facts and information related to the query
3. Relevant context and background information
4. Any important considerations or limitations

Format your response as a structured analysis that can be used for fact-checking purposes.
Focus on accuracy, objectivity, and providing verifiable information.
`;

      const { text: response } = await this.client.chat.completions.create({
        model: 'grok-beta',
        messages: [
          {
            role: 'system',
            content: 'You are a professional fact-checker and information analyst. Provide accurate, well-reasoned responses with clear explanations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      });

      // Create a structured result from Grok's response
      const result: GrokSearchResult = {
        title: `Grok Analysis: ${query}`,
        url: `grok://analysis/${encodeURIComponent(query)}`,
        snippet: response,
        source: 'grok',
        score: 1.0,
        reasoning: `Grok's comprehensive analysis of: ${query}`
      };

      console.log(`✅ Grok Search: Generated comprehensive analysis for "${query}"`);
      return [result];

    } catch (error) {
      console.error('Grok search error:', error);
      throw new Error(`Grok search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async multiSearch(queries: string[]): Promise<GrokSearchResult[]> {
    if (!this.isConfigured) {
      throw new Error('Grok API not configured - XAI_API_KEY missing');
    }

    console.log(`🔍 Grok Multi-Search: Processing ${queries.length} queries`);
    
    const allResults: GrokSearchResult[] = [];
    
    // Process queries in parallel for better performance
    const searchPromises = queries.map(async (query, index) => {
      try {
        const results = await this.search(query);
        return results.map(result => ({
          ...result,
          score: result.score - (index * 0.1) // Slightly lower score for later queries
        }));
      } catch (error) {
        console.warn(`Failed to process query "${query}":`, error);
        return [];
      }
    });

    const resultsArrays = await Promise.all(searchPromises);
    
    // Flatten and deduplicate results
    for (const results of resultsArrays) {
      allResults.push(...results);
    }

    // Remove duplicates based on query similarity
    const uniqueResults = this.deduplicateResults(allResults);
    
    console.log(`✅ Grok Multi-Search: Generated ${uniqueResults.length} unique analyses`);
    return uniqueResults.slice(0, 10); // Limit to top 10 results
  }

  private deduplicateResults(results: GrokSearchResult[]): GrokSearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      const key = result.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}

// Export singleton instance
export const grokSearchProvider = new GrokSearchProviderImpl();
