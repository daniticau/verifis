import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import * as cheerio from 'cheerio';
import { FetchedPage } from './fetchPage';

// Types for extracted content
export interface ExtractedContent {
  title: string;
  byline?: string;
  text: string;
  topImage?: string;
  excerpt?: string;
  siteName?: string;
  publishedTime?: string;
  readingTime?: number;
  language?: string;
  success: boolean;
  method: 'readability' | 'cheerio' | 'fallback';
}

// Configuration
const READABILITY_CONFIG = {
  maxTextLength: 50000, // 50k chars max
  minTextLength: 100,   // 100 chars min
  maxExcerptLength: 300, // 300 chars for excerpt
  supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'ko', 'zh']
};

// Try to detect language from HTML
function detectLanguage(html: string): string {
  const langMatch = html.match(/<html[^>]*lang=["']([^"']+)["']/i);
  if (langMatch) {
    const lang = langMatch[1].toLowerCase().substring(0, 2);
    if (READABILITY_CONFIG.supportedLanguages.includes(lang)) {
      return lang;
    }
  }
  return 'en'; // Default to English
}

// Extract content using Mozilla Readability
async function extractWithReadability(page: FetchedPage): Promise<ExtractedContent | null> {
  try {
    // Create JSDOM instance
    const dom = new JSDOM(page.html, {
      url: page.url,
      pretendToBeVisual: true,
      resources: 'usable'
    });

    // Create Readability instance
    const reader = new Readability(dom.window.document, {
      charThreshold: READABILITY_CONFIG.minTextLength,
      classesToPreserve: ['verifis-content', 'fact-check', 'evidence']
    });

    // Parse the document
    const article = reader.parse();
    
    if (!article || !article.textContent || article.textContent.length < READABILITY_CONFIG.minTextLength) {
      return null;
    }

    // Clean and process text
    const cleanText = article.textContent
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, READABILITY_CONFIG.maxTextLength);

    // Create excerpt
    const excerpt = cleanText.length > READABILITY_CONFIG.maxExcerptLength
      ? cleanText.substring(0, READABILITY_CONFIG.maxExcerptLength) + '...'
      : cleanText;

    // Estimate reading time (average 200 words per minute)
    const wordCount = cleanText.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200);

    return {
      title: article.title || page.title,
      byline: article.byline || undefined,
      text: cleanText,
      topImage: (article as any).topImage || undefined,
      excerpt,
      siteName: article.siteName || undefined,
      publishedTime: article.publishedTime || undefined,
      readingTime,
      language: detectLanguage(page.html),
      success: true,
      method: 'readability'
    };

  } catch (error) {
    console.warn('Readability extraction failed:', error);
    return null;
  }
}

// Extract content using Cheerio (fallback)
function extractWithCheerio(page: FetchedPage): ExtractedContent {
  try {
    const $ = cheerio.load(page.html);
    
    // Remove unwanted elements
    $('script, style, nav, header, footer, aside, .ad, .advertisement, .sidebar').remove();
    
    // Try to find main content areas
    let content = '';
    let title = page.title;
    
    // Look for article content
    const articleSelectors = [
      'article',
      '[role="main"]',
      '.content',
      '.post-content',
      '.entry-content',
      '.article-content',
      'main'
    ];
    
    for (const selector of articleSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        content = element.text();
        break;
      }
    }
    
    // Fallback to body if no article found
    if (!content) {
      content = $('body').text();
    }
    
    // Clean content
    const cleanText = content
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, READABILITY_CONFIG.maxTextLength);
    
    // Create excerpt
    const excerpt = cleanText.length > READABILITY_CONFIG.maxExcerptLength
      ? cleanText.substring(0, READABILITY_CONFIG.maxExcerptLength) + '...'
      : cleanText;
    
    // Estimate reading time
    const wordCount = cleanText.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200);
    
    // Try to find byline
    const bylineSelectors = [
      '.byline',
      '.author',
      '.author-name',
      '[rel="author"]',
      '.meta .author'
    ];
    
    let byline: string | undefined;
    for (const selector of bylineSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        byline = element.text().trim();
        break;
      }
    }
    
    // Try to find top image
    const topImage = $('img').first().attr('src') || undefined;
    
    return {
      title,
      byline,
      text: cleanText,
      topImage,
      excerpt,
      siteName: undefined,
      publishedTime: undefined,
      readingTime,
      language: detectLanguage(page.html),
      success: cleanText.length >= READABILITY_CONFIG.minTextLength,
      method: 'cheerio'
    };
    
  } catch (error) {
    console.warn('Cheerio extraction failed:', error);
    return {
      title: page.title,
      text: page.text,
      success: false,
      method: 'fallback'
    };
  }
}

// Main extraction function
export async function extractContent(page: FetchedPage): Promise<ExtractedContent> {
  // Try Readability first
  const readabilityResult = await extractWithReadability(page);
  if (readabilityResult && readabilityResult.success) {
    return readabilityResult;
  }
  
  // Fallback to Cheerio
  const cheerioResult = extractWithCheerio(page);
  if (cheerioResult.success) {
    return cheerioResult;
  }
  
  // Final fallback to basic text
  return {
    title: page.title,
    text: page.text,
    success: true,
    method: 'fallback'
  };
}

// Batch extract content from multiple pages
export async function extractContents(pages: FetchedPage[]): Promise<ExtractedContent[]> {
  const results: ExtractedContent[] = [];
  
  // Process pages concurrently with concurrency limit
  const concurrencyLimit = 3;
  const chunks = [];
  
  for (let i = 0; i < pages.length; i += concurrencyLimit) {
    chunks.push(pages.slice(i, i + concurrencyLimit));
  }
  
  for (const chunk of chunks) {
    const promises = chunk.map(async (page) => {
      try {
        return await extractContent(page);
      } catch (error) {
        console.warn(`Content extraction failed for ${page.url}:`, error);
        return {
          title: page.title,
          text: page.text,
          success: false,
          method: 'fallback' as const
        };
      }
    });
    
    const chunkResults = await Promise.all(promises);
    results.push(...chunkResults);
  }
  
  return results;
}

// Utility function to check if content is likely an article
export function isLikelyArticle(content: ExtractedContent): boolean {
  if (!content.success || content.text.length < 500) {
    return false;
  }
  
  // Check for article indicators
  const hasTitle = content.title && content.title.length > 10;
  const hasByline = !!content.byline;
  const hasReadingTime = content.readingTime && content.readingTime > 1;
  const hasExcerpt = content.excerpt && content.excerpt.length > 100;
  
  // Score the likelihood
  let score = 0;
  if (hasTitle) score += 2;
  if (hasByline) score += 1;
  if (hasReadingTime) score += 1;
  if (hasExcerpt) score += 1;
  if (content.text.length > 1000) score += 2;
  
  return score >= 4; // Threshold for likely article
}

// Utility function to get content summary
export function getContentSummary(content: ExtractedContent): string {
  if (!content.success) {
    return 'Content extraction failed';
  }
  
  const parts = [];
  
  if (content.title) {
    parts.push(`Title: ${content.title}`);
  }
  
  if (content.byline) {
    parts.push(`By: ${content.byline}`);
  }
  
  if (content.excerpt) {
    parts.push(`Summary: ${content.excerpt}`);
  }
  
  if (content.readingTime) {
    parts.push(`Reading time: ~${content.readingTime} min`);
  }
  
  if (content.publishedTime) {
    parts.push(`Published: ${content.publishedTime}`);
  }
  
  return parts.join('\n');
}
