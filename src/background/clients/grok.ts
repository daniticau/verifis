// Grok API client with Live Search support
import { GrokConfig } from '../../shared/config';
import { 
  GrokSearchResponse, 
  CredResult, 
  GrokError, 
  RateLimitError, 
  APIKeyError 
} from '../../shared/types';

export class GrokClient {
  private readonly baseUrl = 'https://api.x.ai/v1';
  private readonly config: GrokConfig;
  private requestCount = 0;
  private lastRequestTime = 0;
  private readonly rateLimit = 3; // requests per window
  private readonly rateLimitWindow = 10000; // 10 seconds

  constructor(config: GrokConfig) {
    this.config = config;
  }

  // Rate limiting check
  private checkRateLimit(): void {
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
  private async makeRequest(endpoint: string, body: any): Promise<any> {
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
        } else if (response.status === 429) {
          throw new RateLimitError('Rate limit exceeded');
        } else if (response.status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        }
        
        throw new GrokError(errorMessage, 'API_ERROR', response.status);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof GrokError) {
        throw error;
      }
      throw new GrokError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NETWORK_ERROR'
      );
    }
  }

  // Search with Live Search enabled
  async search(claim: string, useFastModel: boolean = false): Promise<GrokSearchResponse> {
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
  async summarizeAndScore(urls: string[], claim: string, useFastModel: boolean = false): Promise<CredResult> {
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
  private parseCredResult(content: string): CredResult {
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
      parsed.per_source = parsed.per_source.map((source: any) => ({
        ...source,
        credibility: Math.max(0, Math.min(100, source.credibility || 50))
      }));
      
      parsed.overall_score = Math.max(0, Math.min(100, parsed.overall_score));
      
      return parsed as CredResult;
    } catch (error) {
      console.error('Failed to parse Grok response:', content);
      throw new GrokError(
        `Failed to parse AI response: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
        'PARSE_ERROR'
      );
    }
  }

  // Get client status
  getStatus(): { rateLimitRemaining: number; lastRequestTime: number } {
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
