import { SearchResult } from './search';
import { ExtractedContent } from './readability';
import { getDomain } from './fetchPage';

// Types for enhanced sources
export interface EnhancedSource {
  title: string;
  url: string;
  snippet: string;
  source: 'bing' | 'google' | 'brave' | 'duckduckgo' | 'wikipedia';
  score: number;
  reliability: 'high' | 'medium' | 'low';
  domain: string;
  isDuplicate: boolean;
  duplicateOf?: string;
}

export interface SourceWithContent extends EnhancedSource {
  content?: ExtractedContent;
  quote?: string;
  relevanceScore: number;
}

// Reliability scoring configuration
const RELIABILITY_CONFIG = {
  // TLD-based scoring
  tldScores: {
    high: ['.gov', '.edu', '.int', '.mil', '.org.au', '.gov.au', '.edu.au'],
    medium: ['.org', '.ac.uk', '.gov.uk', '.nhs.uk', '.ca', '.gc.ca', '.gov.ca'],
    low: ['.com', '.net', '.info', '.biz', '.co', '.io', '.me', '.tv']
  },
  
  // High-reliability domains (fact-checking, academic, government)
  highReliabilityDomains: [
    'factcheck.org',
    'snopes.com',
    'reuters.com',
    'ap.org',
    'bbc.com',
    'npr.org',
    'pbs.org',
    'wikipedia.org',
    'scholar.google.com',
    'pubmed.ncbi.nlm.nih.gov',
    'arxiv.org',
    'researchgate.net',
    'academia.edu',
    'jstor.org',
    'ieee.org',
    'acm.org',
    'nature.com',
    'science.org',
    'thelancet.com',
    'nejm.org',
    'who.int',
    'cdc.gov',
    'nih.gov',
    'fda.gov',
    'epa.gov',
    'nasa.gov',
    'noaa.gov',
    'usgs.gov',
    'whitehouse.gov',
    'congress.gov',
    'supremecourt.gov'
  ],
  
  // Medium-reliability domains (established news, educational)
  mediumReliabilityDomains: [
    'nytimes.com',
    'washingtonpost.com',
    'wsj.com',
    'latimes.com',
    'chicagotribune.com',
    'usatoday.com',
    'cnn.com',
    'foxnews.com',
    'msnbc.com',
    'abcnews.go.com',
    'cbsnews.com',
    'nbcnews.com',
    'time.com',
    'newsweek.com',
    'theatlantic.com',
    'newyorker.com',
    'harvard.edu',
    'mit.edu',
    'stanford.edu',
    'yale.edu',
    'princeton.edu',
    'columbia.edu',
    'berkeley.edu',
    'ucla.edu',
    'ucsd.edu',
    'umich.edu',
    'utexas.edu',
    'gatech.edu',
    'cmu.edu',
    'caltech.edu'
  ],
  
  // Low-reliability domains (blog platforms, social media, etc.)
  lowReliabilityDomains: [
    'blogspot.com',
    'wordpress.com',
    'tumblr.com',
    'medium.com',
    'substack.com',
    'facebook.com',
    'twitter.com',
    'instagram.com',
    'tiktok.com',
    'youtube.com',
    'reddit.com',
    'quora.com',
    'yahoo.com',
    'aol.com',
    'msn.com',
    'buzzfeed.com',
    'vice.com',
    'vox.com',
    'huffpost.com',
    'dailywire.com',
    'breitbart.com',
    'infowars.com',
    'naturalnews.com',
    'mercola.com',
    'drudgereport.com',
    'worldnetdaily.com'
  ]
};

// Score reliability based on TLD and domain
export function scoreReliability(url: string): 'high' | 'medium' | 'low' {
  const domain = getDomain(url);
  
  // Check high-reliability domains first
  if (RELIABILITY_CONFIG.highReliabilityDomains.some(d => domain.includes(d))) {
    return 'high';
  }
  
  // Check medium-reliability domains
  if (RELIABILITY_CONFIG.mediumReliabilityDomains.some(d => domain.includes(d))) {
    return 'medium';
  }
  
  // Check low-reliability domains
  if (RELIABILITY_CONFIG.lowReliabilityDomains.some(d => domain.includes(d))) {
    return 'low';
  }
  
  // TLD-based scoring
  const tld = domain.split('.').slice(-2).join('.');
  
  if (RELIABILITY_CONFIG.tldScores.high.some(t => tld.endsWith(t))) {
    return 'high';
  }
  
  if (RELIABILITY_CONFIG.tldScores.medium.some(t => tld.endsWith(t))) {
    return 'medium';
  }
  
  if (RELIABILITY_CONFIG.tldScores.low.some(t => tld.endsWith(t))) {
    return 'low';
  }
  
  // Default to medium for unknown domains
  return 'medium';
}

// Deduplicate sources by domain
export function deduplicateSources(sources: SearchResult[]): EnhancedSource[] {
  const domainMap = new Map<string, EnhancedSource>();
  const duplicates: EnhancedSource[] = [];
  
  for (const source of sources) {
    // Validate source data before processing
    if (!source.title || !source.url || !source.snippet || 
        source.title.length === 0 || source.url.length === 0 || source.snippet.length === 0) {
      console.warn('Skipping invalid source:', { 
        title: source.title, 
        url: source.url, 
        snippet: source.snippet?.length || 0 
      });
      continue;
    }
    
    const domain = getDomain(source.url);
    
    // Ensure we have a valid domain
    if (!domain || domain.length === 0) {
      console.warn('Skipping source with invalid domain:', source.url);
      continue;
    }
    
    // HARD BLACKLIST: Filter out Wikipedia sources completely (we want diverse sources)
    if (domain.includes('wikipedia.org') || domain.includes('wikipedia.com')) {
      console.log(`🚫 Blacklisted Wikipedia source at deduplication stage: ${source.url}`);
      continue;
    }
    
    const existing = domainMap.get(domain);
    
    if (existing) {
      // Keep the higher-scoring source
      if (source.score > existing.score) {
        // Mark existing as duplicate
        existing.isDuplicate = true;
        existing.duplicateOf = source.url;
        duplicates.push(existing);
        
        // Replace with new source
        const enhancedSource: EnhancedSource = {
          title: source.title,
          url: source.url,
          snippet: source.snippet,
          source: source.source,
          score: source.score,
          reliability: scoreReliability(source.url),
          domain,
          isDuplicate: false
        };
        domainMap.set(domain, enhancedSource);
      } else {
        // Mark current as duplicate
        const enhancedSource: EnhancedSource = {
          title: source.title,
          url: source.url,
          snippet: source.snippet,
          source: source.source,
          score: source.score,
          reliability: scoreReliability(source.url),
          domain,
          isDuplicate: true,
          duplicateOf: existing.url
        };
        duplicates.push(enhancedSource);
      }
    } else {
      // First occurrence of this domain
      const enhancedSource: EnhancedSource = {
        title: source.title,
        url: source.url,
        snippet: source.snippet,
        source: source.source,
        score: source.score,
        reliability: scoreReliability(source.url),
        domain,
        isDuplicate: false
      };
      domainMap.set(domain, enhancedSource);
    }
  }
  
  // Return unique sources sorted by score
  const validSources = Array.from(domainMap.values())
    .sort((a, b) => b.score - a.score)
    .filter(source => 
      source.title && source.url && source.snippet && 
      source.title.length > 0 && source.url.length > 0 && source.snippet.length > 0
    );
  
  console.log(`Deduplication complete: ${validSources.length} valid sources from ${sources.length} original sources`);
  return validSources;
}

// Enhance sources with content and relevance scoring
export function enhanceSourcesWithContent(
  sources: EnhancedSource[],
  contents: ExtractedContent[],
  targetText: string
): SourceWithContent[] {
  const enhanced: SourceWithContent[] = [];
  
  for (const source of sources) {
    // Validate source before processing
    if (!source.title || !source.url || !source.snippet) {
      console.warn('Skipping invalid source in content enhancement:', source);
      continue;
    }
    
    const content = contents.find(c => (c as any).url === source.url);
    
    // Calculate relevance score based on content similarity
    let relevanceScore = source.score;
    let quote: string | undefined;
    
    if (content && content.success) {
      // Boost score for articles
      if (content.text.length > 1000) {
        relevanceScore += 0.2;
      }
      
      // Boost score for high-reliability sources
      if (source.reliability === 'high') {
        relevanceScore += 0.3;
      } else if (source.reliability === 'medium') {
        relevanceScore += 0.1;
      }
      
      // Find relevant quote (simple keyword matching)
      quote = findRelevantQuote(content.text, targetText);
      if (quote) {
        relevanceScore += 0.2;
      }
    }
    
    enhanced.push({
      ...source,
      content,
      quote,
      relevanceScore: Math.min(relevanceScore, 1.0) // Cap at 1.0
    });
  }
  
  // Sort by relevance score and filter out any invalid sources
  const validEnhanced = enhanced.filter(source => 
    source.title && source.url && source.snippet && 
    source.title.length > 0 && source.url.length > 0 && source.snippet.length > 0
  );
  
  console.log(`Content enhancement complete: ${validEnhanced.length} valid sources from ${enhanced.length} processed sources`);
  return validEnhanced.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// Find relevant quote from content
function findRelevantQuote(content: string, targetText: string): string | undefined {
  // Simple approach: find sentences containing key terms
  const targetWords = targetText
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3) // Only meaningful words
    .slice(0, 5); // Top 5 words
  
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
  
  for (const sentence of sentences) {
    const sentenceLower = sentence.toLowerCase();
    const matches = targetWords.filter(word => sentenceLower.includes(word));
    
    if (matches.length >= 2) { // At least 2 key terms match
      return sentence.trim() + '.';
    }
  }
  
  return undefined;
}

// Filter sources by minimum requirements
export function filterSourcesByRequirements(
  sources: SourceWithContent[],
  minSources: number = 1,
  preferIndependent: boolean = true
): SourceWithContent[] {
  // Filter out invalid sources first
  const validSources = sources.filter(source => 
    source.title && source.url && source.snippet && 
    source.title.length > 0 && source.url.length > 0 && source.snippet.length > 0
  );
  
  if (validSources.length <= minSources) {
    return validSources;
  }
  
  if (preferIndependent) {
    // Try to get sources from different domains
    const independentSources: SourceWithContent[] = [];
    const usedDomains = new Set<string>();
    
    for (const source of validSources) {
      if (!usedDomains.has(source.domain)) {
        independentSources.push(source);
        usedDomains.add(source.domain);
        
        if (independentSources.length >= minSources) {
          break;
        }
      }
    }
    
    // If we don't have enough independent sources, add more
    if (independentSources.length < minSources) {
      for (const source of validSources) {
        if (!independentSources.some(s => s.url === source.url)) {
          independentSources.push(source);
          if (independentSources.length >= minSources) {
            break;
          }
        }
      }
    }
    
    return independentSources;
  }
  
  // Just return top N sources
  return validSources.slice(0, minSources);
}

// Get source summary for display
export function getSourceSummary(source: SourceWithContent): string {
  const parts = [];
  
  parts.push(`Source: ${source.title}`);
  parts.push(`Domain: ${source.domain}`);
  parts.push(`Reliability: ${source.reliability.toUpperCase()}`);
  
  if (source.content?.excerpt) {
    parts.push(`Summary: ${source.content.excerpt}`);
  }
  
  if (source.quote) {
    parts.push(`Relevant Quote: "${source.quote}"`);
  }
  
  return parts.join('\n');
}

// Validate source URLs
export function validateSourceUrls(sources: SourceWithContent[]): SourceWithContent[] {
  return sources.filter(source => {
    // Check if source has all required fields
    if (!source.title || !source.url || !source.snippet || 
        source.title.length === 0 || source.url.length === 0 || source.snippet.length === 0) {
      console.warn(`Skipping source with missing fields:`, { 
        title: source.title?.length || 0, 
        url: source.url?.length || 0, 
        snippet: source.snippet?.length || 0 
      });
      return false;
    }
    
    try {
      new URL(source.url);
      return true;
    } catch {
      console.warn(`Invalid URL: ${source.url}`);
      return false;
    }
  });
}
