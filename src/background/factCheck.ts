// Fact-checking service that orchestrates Grok Live Search and credibility scoring
import { GrokClient } from './clients/grok';
import { GrokConfig } from '../shared/config';
import { 
  FactCheckRequest, 
  FactCheckResult, 
  FactCheckResponse,
  GrokError,
  ValidationError
} from '../shared/types';

export class FactCheckService {
  private grokClient: GrokClient;
  private config: GrokConfig;

  constructor(config: GrokConfig) {
    this.config = config;
    this.grokClient = new GrokClient(config);
  }

  // Main fact-checking method
  async factCheck(request: FactCheckRequest): Promise<FactCheckResponse> {
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
      const credResult = await this.grokClient.summarizeAndScore(
        searchResult.citations,
        request.claim,
        request.useFastModel
      );
      
      // Step 3: Transform to final result format
      const result: FactCheckResult = {
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
      
    } catch (error) {
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
  private validateRequest(request: FactCheckRequest): void {
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
  private extractDomain(url: string): string {
    try {
      const domain = new URL(url).hostname.replace(/^www\./, '');
      return domain;
    } catch {
      return 'unknown';
    }
  }

  // Validate URL format
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Get service status
  getStatus(): { 
    config: Omit<GrokConfig, 'apiKey'>;
    grokStatus: { rateLimitRemaining: number; lastRequestTime: number };
  } {
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
