import { NextResponse } from "next/server";
import { z } from "zod";
import * as cheerio from "cheerio";
import { generateObject, generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { searchOrchestrator } from "../../../lib/search";
import { fetchPages } from "../../../lib/fetchPage";
import { extractContents } from "../../../lib/readability";
import { 
  deduplicateSources, 
  enhanceSourcesWithContent, 
  filterSourcesByRequirements,
  validateSourceUrls 
} from "../../../lib/sources";

export const runtime = "nodejs";
export const maxDuration = 60; // Increased for web crawling

const ClaimsSchema = z.object({
  claims: z.array(z.object({
    claim: z.string().min(6),
    quote: z.string().optional(),
    confidence: z.number().min(0).max(1).default(0.5),
    sources: z.array(z.object({
      title: z.string().min(1),
      url: z.string().url(),
      snippet: z.string().min(10).default('No description available'),
      reliability: z.enum(['high', 'medium', 'low']).default('medium'),
      quote: z.string().optional(),
      domain: z.string().min(1)
    })).min(1).max(3),
  })).max(8),
});

const SnippetClaimsSchema = z.object({
  claims: z.array(z.object({
    claim: z.string().min(6),
    status: z.enum(['likely true', 'likely false', 'uncertain']),
    confidence: z.number().min(0).max(1).default(0.5),
    justification: z.string().min(10),
    sources: z.array(z.object({
      title: z.string().min(1),
      url: z.string().url(),
      snippet: z.string().min(10).default('No description available'),
      reliability: z.enum(['high', 'medium', 'low']).default('medium'),
      quote: z.string().optional(),
      domain: z.string().min(1)
    })).min(1).max(3),
  })).max(5),
});

// Helper function to add CORS headers
function addCorsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

export async function OPTIONS() {
  return addCorsHeaders(new NextResponse(null, { status: 200 }));
}

// Generate focused search queries for fact-checking
function generateSearchQueries(text: string, isSnippet: boolean): string[] {
  if (isSnippet) {
    // For snippets, create 2-3 focused queries
    const queries = [];
    
    // Main fact-check query
    queries.push(`fact check: ${text.substring(0, 100)}`);
    
    // Extract key terms for additional queries
    const words = text.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 4 && !['the', 'and', 'that', 'this', 'with', 'from'].includes(word))
      .slice(0, 3);
    
    if (words.length >= 2) {
      queries.push(`${words[0]} ${words[1]} fact check`);
    }
    
    if (words.length >= 3) {
      queries.push(`${words[1]} ${words[2]} verification`);
    }
    
    return queries.slice(0, 3);
  } else {
    // For full pages, extract candidate claims and create queries
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const queries = [];
    
    // Take first few sentences that look like claims
    for (let i = 0; i < Math.min(3, sentences.length); i++) {
      const sentence = sentences[i].trim();
      if (sentence.length > 30 && sentence.length < 200) {
        queries.push(`fact check: ${sentence.substring(0, 100)}`);
      }
    }
    
    return queries.slice(0, 3);
  }
}

// Main fact-checking pipeline
async function runFactCheckingPipeline(
  text: string, 
  isSnippet: boolean, 
  clientIP?: string
): Promise<{ sources: any[]; totalResults: number }> {
  try {
    // Step 1: Generate search queries
    const queries = generateSearchQueries(text, isSnippet);
    console.log(`Generated ${queries.length} search queries for fact-checking`);
    
    // Step 2: Perform multi-source search
    const searchResults = await searchOrchestrator.multiSearch(queries);
    console.log(`Found ${searchResults.length} search results`);
    
    // Log source distribution for debugging
    const sourceCounts = searchResults.reduce((acc, result) => {
      acc[result.source] = (acc[result.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('🔍 Search results by source:', sourceCounts);
    
    // If we have Brave results, filter out Wikipedia completely
    const hasBraveResults = searchResults.some(result => result.source === 'brave');
    if (hasBraveResults) {
      console.log('🎯 Brave results detected - filtering out Wikipedia sources completely');
      const braveOnlyResults = searchResults.filter(result => result.source !== 'wikipedia');
      console.log(`🎯 After filtering Wikipedia: ${braveOnlyResults.length} results (was ${searchResults.length})`);
      // Replace searchResults with Brave-only results
      searchResults.splice(0, searchResults.length, ...braveOnlyResults);
    }
    
    if (searchResults.length === 0) {
      console.warn('No search results found from any provider - this should not happen with DuckDuckGo fallback');
      // Create a minimal response that tells users to check their connection
      return {
        sources: [{
          title: 'No web sources found - check your Brave API key',
          url: `https://duckduckgo.com/?q=${encodeURIComponent(queries[0] || 'fact check')}`,
          snippet: 'Web search failed. Please check your BRAVE_API_KEY in .env.local or click to search manually.',
          reliability: 'low' as const,
          domain: 'verifis.app',
          quote: undefined
        }],
        totalResults: 0
      };
    }
    
    // Step 3: Deduplicate and enhance sources
    const enhancedSources = deduplicateSources(searchResults);
    console.log(`After deduplication: ${enhancedSources.length} unique sources`);
    
    // Step 4: Fetch top 5-8 pages
    const topSources = enhancedSources.slice(0, 8);
    const urls = topSources.map(s => s.url).filter(url => url && url.length > 0);
    
    if (urls.length === 0) {
      throw new Error('No valid URLs found in search results');
    }
    
    const fetchedPages = await fetchPages(urls, clientIP);
    console.log(`Successfully fetched ${fetchedPages.length} pages`);
    
    // Step 5: Extract content from fetched pages
    const extractedContents = await extractContents(fetchedPages);
    console.log(`Extracted content from ${extractedContents.length} pages`);
    
    // Step 6: Enhance sources with content and relevance scoring
    const sourcesWithContent = enhanceSourcesWithContent(
      enhancedSources.slice(0, 5), // Top 5 sources
      extractedContents,
      text
    );
    
    // Step 7: Filter sources by requirements (prefer independent sources)
    const finalSources = filterSourcesByRequirements(
      sourcesWithContent,
      isSnippet ? 2 : 3, // Require 2-3 sources
      true // Prefer independent sources
    );
    
    // Step 8: Validate URLs and prepare for AI
    const validatedSources = validateSourceUrls(finalSources);
    
    // Format sources for AI consumption
    const formattedSources = validatedSources.map(source => ({
      title: source.title,
      url: source.url,
      snippet: source.snippet,
      reliability: source.reliability,
      domain: source.domain,
      quote: source.quote,
      content: source.content ? {
        excerpt: source.content.excerpt,
        readingTime: source.content.readingTime,
        byline: source.content.byline
      } : undefined
    }));
    
    return {
      sources: formattedSources,
      totalResults: searchResults.length
    };
    
  } catch (error) {
    console.error('Fact-checking pipeline failed:', error);
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { url, text: snippetText, isSnippet } = body;
    
    // Debug: Check if API keys are loaded
    console.log('🔑 Environment check:');
    console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing'}`);
    console.log(`  BRAVE_API_KEY: ${process.env.BRAVE_API_KEY ? '✅ Set' : '❌ Missing'}`);
    console.log(`  BING_API_KEY: ${process.env.BING_API_KEY ? '✅ Set' : '❌ Missing'}`);
    console.log(`  GOOGLE_CSE_KEY: ${process.env.GOOGLE_CSE_KEY ? '✅ Set' : '❌ Missing'}`);
    console.log('📊 Request details:', { url, textLength: snippetText?.length, isSnippet });
    
    if (!url) {
      const response = NextResponse.json({ error: "Missing url" }, { status: 400 });
      return addCorsHeaders(response);
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const response = NextResponse.json({ error: "Server missing OPENAI_API_KEY" }, { status: 500 });
      return addCorsHeaders(response);
    }

    let text: string;
    let isSnippetMode = false;

    // Handle snippet mode vs full page mode
    if (isSnippet && snippetText && snippetText.length < 2000) {
      text = snippetText;
      isSnippetMode = true;
    } else {
      // Full page mode - fetch HTML
      const res = await fetch(url, {
        headers: { "user-agent": "Verifis/0.1 (+https://verifis.app)" },
        redirect: "follow",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);
      const html = await res.text();
      const $ = cheerio.load(html);
      const extractedText = $("article").text().trim() ||
        $("main").text().trim() ||
        $("body").text().trim();
      if (!extractedText) throw new Error("No readable text found on page");
      text = extractedText.replace(/\s+/g, " ").slice(0, 20000);
      isSnippetMode = false;
    }

    const openai = createOpenAI({ apiKey });

    if (isSnippetMode) {
      // Snippet mode: enhanced verification with web search
      console.log('Running snippet mode fact-checking pipeline...');
      
      const { sources, totalResults } = await runFactCheckingPipeline(text, true);
      
      if (sources.length === 0) {
        throw new Error('No reliable sources found for fact-checking');
      }
      
      // Create curated excerpts for AI
      const curatedExcerpts = sources.map(source => 
        `Source: ${source.title}\nDomain: ${source.domain}\nReliability: ${source.reliability}\nContent: ${source.snippet}${source.quote ? `\nRelevant Quote: "${source.quote}"` : ''}`
      ).join('\n\n');
      
      const prompt = 
      
`
System:
You are a rigorously cautious fact-checker with access to multiple web sources. Use the provided source information to verify claims and provide evidence-based assessments. Always cite specific sources and include relevant quotes when available.

Task:
Given the highlighted text and multiple web sources, extract 1–3 atomic, checkable factual claims (no opinions, predictions, or vague generalities). For each claim:
- Produce a binary assessment from {"likely true","likely false","uncertain"}.
- Provide a confidence in [0,1] with two decimals, where 0.95+ means "established by consensus," 0.50 is "could go either way," and ≤0.35 means "little basis."
- Give a one-sentence justification that references concrete facts, numbers, or definitions (avoid hedging and fluff).
- Provide 1-3 relevant sources that support or refute the claim, including:
  * Source title/name
  * URL (required)
  * Brief description of what the source contains
  * Reliability rating (high/medium/low)
  * Exact quote from the source if relevant
  * Domain for transparency

Rules:
- Split compound statements into atomic claims.
- Respect scope, units, time ("as of YYYY-MM-DD" if timing matters), and definitions.
- If claim hinges on a missing definition or ambiguous scope, mark "uncertain."
- If no checkable claims exist, return an empty list with a meta reason.
- Use the provided sources to find supporting or refuting evidence.
- Sources must include valid URLs and be properly cited.
- Prefer high-reliability sources when available.
- Include exact quotes when they directly support or refute a claim.

Return JSON only: { "claims": [ { "claim", "status", "confidence", "justification", "sources" } ] }.

HIGHLIGHTED TEXT:
${text}

WEB SOURCES (${sources.length} sources from ${totalResults} total results):
${curatedExcerpts}`;

      try {
        const { object } = await generateObject({
          model: openai("gpt-4o-mini"),
          schema: SnippetClaimsSchema,
          prompt,
          temperature: 0.1,
        });
        const response = NextResponse.json({ url, ...object });
        return addCorsHeaders(response);
      } catch (strictErr: any) {
        console.error("Snippet strict JSON failed:", strictErr?.message);

        // Fallback for snippets
        const { text: raw } = await generateText({
          model: openai("gpt-4o-mini"),
          prompt: prompt + `\n\nIMPORTANT: Return ONLY valid JSON. Do not include any text before or after the JSON object.`,
          temperature: 0.1,
        });

        console.log("Raw AI response for parsing:", raw?.slice(0, 1000));

        try {
          // Clean the response to extract just the JSON
          let jsonText = raw.trim();
          
          // Try to find JSON object boundaries
          const jsonStart = jsonText.indexOf('{');
          const jsonEnd = jsonText.lastIndexOf('}');
          
          if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            jsonText = jsonText.substring(jsonStart, jsonEnd + 1);
          }
          
          console.log("Cleaned JSON text:", jsonText);
          
          const parsed = JSON.parse(jsonText);
          
          // Clean and validate the parsed data before schema validation
          if (parsed.claims && Array.isArray(parsed.claims)) {
            parsed.claims = parsed.claims.map((claim: any) => {
              // Handle empty sources arrays by providing a default source
              if (!claim.sources || !Array.isArray(claim.sources) || claim.sources.length === 0) {
                claim.sources = [{
                  title: 'Manual verification required',
                  url: 'https://duckduckgo.com/?q=' + encodeURIComponent(claim.claim),
                  snippet: 'This claim requires manual fact-checking. Click the link to search for verification.',
                  reliability: 'low' as const,
                  quote: undefined,
                  domain: 'duckduckgo.com'
                }];
              } else {
                // Clean existing sources
                claim.sources = claim.sources.map((source: any) => ({
                  title: source.title || 'Untitled',
                  url: source.url || 'https://example.com',
                  snippet: source.snippet || 'No description available',
                  reliability: source.reliability || 'medium',
                  quote: source.quote || undefined,
                  domain: source.domain || new URL(source.url || 'https://example.com').hostname || 'unknown'
                }));
              }
              return claim;
            });
          }
          
          const safe = SnippetClaimsSchema.parse(parsed);
          const response = NextResponse.json({ url, ...safe });
          return addCorsHeaders(response);
        } catch (fallbackErr: any) {
          console.error("Snippet fallback parse failed:", fallbackErr?.message);
          console.error("Raw AI response:", raw);
          console.error("Parse error details:", fallbackErr);
          
          // Return a more helpful error message
          const response = NextResponse.json({ 
            error: "Snippet verification failed (JSON parse). Check logs.",
            details: "AI model returned invalid JSON format",
            rawResponse: raw?.slice(0, 200) // Include first 200 chars for debugging
          }, { status: 500 });
          return addCorsHeaders(response);
        }
      }
    } else {
      // Full page mode: enhanced claim extraction with web search
      console.log('Running full page mode fact-checking pipeline...');
      
      const { sources, totalResults } = await runFactCheckingPipeline(text, false);
      
      if (sources.length === 0) {
        throw new Error('No reliable sources found for fact-checking');
      }
      
      // Create curated excerpts for AI
      const curatedExcerpts = sources.map(source => 
        `Source: ${source.title}\nDomain: ${source.domain}\nReliability: ${source.reliability}\nContent: ${source.snippet}${source.quote ? `\nRelevant Quote: "${source.quote}"` : ''}`
      ).join('\n\n');
      
      const prompt = 
      
`
Extract up to 8 atomic, checkable factual claims from the page text below.
- One sentence per claim.
- Prefer concrete numbers, definitions, product specs, health effects.
- Avoid opinions or vague advice.
- If an exact supporting snippet is obvious, include it as "quote".
- Provide 1-3 relevant sources for each claim, including:
  * Source title/name
  * URL (required)
  * Brief description of what the source contains
  * Reliability rating (high/medium/low)
  * Exact quote from the source if relevant
  * Domain for transparency

Return ONLY a JSON object with { "claims": [{ "claim": string, "quote"?: string, "confidence": number, "sources": array }] }.

PAGE TEXT:
${text}

WEB SOURCES (${sources.length} sources from ${totalResults} total results):
${curatedExcerpts}`;

      // strict path
      try {
        const { object } = await generateObject({
          model: openai("gpt-4o-mini"),
          schema: ClaimsSchema,
          prompt,
          temperature: 0.2,
        });

        const response = NextResponse.json({ url, ...object });
        return addCorsHeaders(response);
      } catch (strictErr: any) {
        console.error("Strict JSON failed:", strictErr?.message);

        // fallback: loose JSON parse
        const { text: raw } = await generateText({
          model: openai("gpt-4o-mini"),
          prompt: prompt + `\n\nIMPORTANT: Return ONLY valid JSON. Do not include any text before or after the JSON object.`,
          temperature: 0.2,
        });

        console.log("Raw AI response for parsing:", raw?.slice(0, 1000));

        try {
          // Clean the response to extract just the JSON
          let jsonText = raw.trim();
          
          // Try to find JSON object boundaries
          const jsonStart = jsonText.indexOf('{');
          const jsonEnd = jsonText.lastIndexOf('}');
          
          if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            jsonText = jsonText.substring(jsonStart, jsonEnd + 1);
          }
          
          console.log("Cleaned JSON text:", jsonText);
          
          const parsed = JSON.parse(jsonText);
          
          // Clean and validate the parsed data before schema validation
          if (parsed.claims && Array.isArray(parsed.claims)) {
            parsed.claims = parsed.claims.map((claim: any) => {
              // Handle empty sources arrays by providing a default source
              if (!claim.sources || !Array.isArray(claim.sources) || claim.sources.length === 0) {
                claim.sources = [{
                  title: 'Manual verification required',
                  url: 'https://duckduckgo.com/?q=' + encodeURIComponent(claim.claim),
                  snippet: 'This claim requires manual fact-checking. Click the link to search for verification.',
                  reliability: 'low' as const,
                  quote: undefined,
                  domain: 'duckduckgo.com'
                }];
              } else {
                // Clean existing sources
                claim.sources = claim.sources.map((source: any) => ({
                  title: source.title || 'Untitled',
                  url: source.url || 'https://example.com',
                  snippet: source.snippet || 'No description available',
                  reliability: source.reliability || 'medium',
                  quote: source.quote || undefined,
                  domain: source.domain || new URL(source.url || 'https://example.com').hostname || 'unknown'
                }));
              }
              return claim;
            });
          }
          
          const safe = ClaimsSchema.parse(parsed);
          const response = NextResponse.json({ url, ...safe });
          return addCorsHeaders(response);
        } catch (fallbackErr: any) {
          console.error("Fallback parse failed:", fallbackErr?.message);
          console.error("Raw AI response:", raw);
          console.error("Parse error details:", fallbackErr);
          
          // Return a more helpful error message
          const response = NextResponse.json({ 
            error: "Claim extraction failed (JSON parse). Check logs.",
            details: "AI model returned invalid JSON format",
            rawResponse: raw?.slice(0, 200) // Include first 200 chars for debugging
          }, { status: 500 });
          return addCorsHeaders(response);
        }
      }
    }
  } catch (e: any) {
    console.error("EXTRACT ERROR:", e?.message);
    const msg = String(e?.message || "Server error");
    const status = msg.startsWith("Fetch failed") || msg.includes("readable text") ? 502 : 500;
    const response = NextResponse.json({ error: msg }, { status });
    return addCorsHeaders(response);
  }
}


