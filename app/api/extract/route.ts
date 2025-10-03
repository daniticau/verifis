import { NextResponse } from "next/server";
import { z } from "zod";
import * as cheerio from "cheerio";
import { generateObject, generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
// Note: Using OpenAI SDK with Grok API endpoint for compatibility

export const runtime = "nodejs";
export const maxDuration = 60;

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

// Grok-powered fact-checking function
async function grokFactCheck(text: string, isSnippet: boolean): Promise<any> {
  const grokApiKey = process.env.XAI_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const apiKey = grokApiKey || openaiApiKey;
  
  if (!apiKey) {
    throw new Error('No API key available (XAI_API_KEY or OPENAI_API_KEY required)');
  }

  const isUsingGrok = !!grokApiKey;
  const openai = createOpenAI({ 
    apiKey,
    baseURL: isUsingGrok ? 'https://api.x.ai/v1' : undefined
  });
  
  console.log(`🤖 Using ${isUsingGrok ? 'Grok AI' : 'OpenAI'} for fact-checking`);

  if (isSnippet) {
    // Snippet mode: focused fact-checking
    const prompt = `
You are an expert fact-checker with access to comprehensive knowledge. Analyze the highlighted text below and provide a thorough fact-checking assessment.

HIGHLIGHTED TEXT:
${text}

Task:
Extract 1-3 atomic, checkable factual claims from the text. For each claim:
- Provide a binary assessment: "likely true", "likely false", or "uncertain"
- Give confidence score (0-1) where 0.95+ = "established by consensus", 0.50 = "could go either way", ≤0.35 = "little basis"
- Provide a clear, evidence-based justification
- Include 1-3 relevant sources with:
  * Source title/name
  * URL (use grok://knowledge/ for Grok's knowledge base)
  * Brief description
  * Reliability rating (high/medium/low)
  * Exact quote if relevant
  * Domain (use "grok.ai" for Grok knowledge)

Rules:
- Split compound statements into atomic claims
- Respect scope, units, time, and definitions
- If claim is ambiguous, mark "uncertain"
- Use your comprehensive knowledge to provide accurate assessments
- Focus on verifiable facts, not opinions

Return JSON only: { "claims": [ { "claim", "status", "confidence", "justification", "sources" } ] }
`;

    try {
      const { object } = await generateObject({
        model: openai(isUsingGrok ? "grok-beta" : "gpt-4o-mini"),
        schema: SnippetClaimsSchema,
        prompt,
        temperature: 0.1,
      });
      return object;
    } catch (strictErr: any) {
      console.error("Strict JSON failed:", strictErr?.message);
      
      // Fallback with text generation
      const { text: raw } = await generateText({
        model: openai(isUsingGrok ? "grok-beta" : "gpt-4o-mini"),
        prompt: prompt + `\n\nIMPORTANT: Return ONLY valid JSON. Do not include any text before or after the JSON object.`,
        temperature: 0.1,
      });

      try {
        let jsonText = raw.trim();
        const jsonStart = jsonText.indexOf('{');
        const jsonEnd = jsonText.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          jsonText = jsonText.substring(jsonStart, jsonEnd + 1);
        }
        
        const parsed = JSON.parse(jsonText);
        
        // Clean and validate the parsed data
        if (parsed.claims && Array.isArray(parsed.claims)) {
          parsed.claims = parsed.claims.map((claim: any) => {
            if (!claim.sources || !Array.isArray(claim.sources) || claim.sources.length === 0) {
              claim.sources = [{
                title: 'Grok Knowledge Base',
                url: 'grok://knowledge/' + encodeURIComponent(claim.claim),
                snippet: 'Comprehensive knowledge analysis from Grok AI',
                reliability: 'high' as const,
                domain: 'grok.ai'
              }];
  } else {
              claim.sources = claim.sources.map((source: any) => ({
                title: source.title || 'Grok Analysis',
                url: source.url || 'grok://knowledge/' + encodeURIComponent(claim.claim),
                snippet: source.snippet || 'AI-powered fact-checking analysis',
                reliability: source.reliability || 'medium',
                quote: source.quote || undefined,
                domain: source.domain || 'grok.ai'
              }));
            }
            return claim;
          });
        }
        
        return SnippetClaimsSchema.parse(parsed);
      } catch (fallbackErr: any) {
        console.error("Fallback parse failed:", fallbackErr?.message);
        throw new Error("AI model returned invalid JSON format");
      }
    }
  } else {
    // Full page mode: comprehensive claim extraction
    const prompt = `
You are an expert fact-checker with comprehensive knowledge. Analyze the page text below and extract up to 8 atomic, checkable factual claims.

PAGE TEXT:
${text}

Task:
Extract factual claims that can be verified. For each claim:
- One sentence per claim
- Prefer concrete numbers, definitions, product specs, health effects
- Avoid opinions or vague advice
- Include confidence score (0-1)
- Provide 1-3 relevant sources with:
  * Source title/name
  * URL (use grok://knowledge/ for Grok's knowledge base)
  * Brief description
  * Reliability rating (high/medium/low)
  * Exact quote if relevant
  * Domain (use "grok.ai" for Grok knowledge)

Return JSON only: { "claims": [ { "claim", "quote"?, "confidence", "sources" } ] }
`;

    try {
      const { object } = await generateObject({
        model: openai(isUsingGrok ? "grok-beta" : "gpt-4o-mini"),
        schema: ClaimsSchema,
        prompt,
        temperature: 0.2,
      });
      return object;
    } catch (strictErr: any) {
      console.error("Strict JSON failed:", strictErr?.message);
      
      // Fallback with text generation
      const { text: raw } = await generateText({
        model: openai(isUsingGrok ? "grok-beta" : "gpt-4o-mini"),
        prompt: prompt + `\n\nIMPORTANT: Return ONLY valid JSON. Do not include any text before or after the JSON object.`,
        temperature: 0.2,
      });

      try {
        let jsonText = raw.trim();
        const jsonStart = jsonText.indexOf('{');
        const jsonEnd = jsonText.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          jsonText = jsonText.substring(jsonStart, jsonEnd + 1);
        }
        
        const parsed = JSON.parse(jsonText);
        
        // Clean and validate the parsed data
        if (parsed.claims && Array.isArray(parsed.claims)) {
          parsed.claims = parsed.claims.map((claim: any) => {
            if (!claim.sources || !Array.isArray(claim.sources) || claim.sources.length === 0) {
              claim.sources = [{
                title: 'Grok Knowledge Base',
                url: 'grok://knowledge/' + encodeURIComponent(claim.claim),
                snippet: 'Comprehensive knowledge analysis from Grok AI',
                reliability: 'high' as const,
                domain: 'grok.ai'
              }];
            } else {
              claim.sources = claim.sources.map((source: any) => ({
                title: source.title || 'Grok Analysis',
                url: source.url || 'grok://knowledge/' + encodeURIComponent(claim.claim),
                snippet: source.snippet || 'AI-powered fact-checking analysis',
                reliability: source.reliability || 'medium',
                quote: source.quote || undefined,
                domain: source.domain || 'grok.ai'
              }));
            }
            return claim;
          });
        }
        
        return ClaimsSchema.parse(parsed);
      } catch (fallbackErr: any) {
        console.error("Fallback parse failed:", fallbackErr?.message);
        throw new Error("AI model returned invalid JSON format");
      }
    }
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { url, text: snippetText, isSnippet } = body;
    
    // Debug: Check if API keys are loaded
    console.log('🔑 Environment check:');
    console.log(`  XAI_API_KEY: ${process.env.XAI_API_KEY ? '✅ Set' : '❌ Missing'}`);
    console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set (fallback)' : '❌ Missing'}`);
    console.log('📊 Request details:', { url, textLength: snippetText?.length, isSnippet });
    
    if (!url) {
      const response = NextResponse.json({ error: "Missing url" }, { status: 400 });
      return addCorsHeaders(response);
    }

    // Try Grok API key first, fallback to OpenAI
    const grokApiKey = process.env.XAI_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!grokApiKey && !openaiApiKey) {
      const response = NextResponse.json({ error: "Server missing XAI_API_KEY or OPENAI_API_KEY" }, { status: 500 });
      return addCorsHeaders(response);
    }

    let text: string;
    let isSnippetMode = false;

    // Handle snippet mode vs full page mode
    if (isSnippet && snippetText && snippetText.length < 2000) {
      text = snippetText;
      isSnippetMode = true;
      console.log('📝 Processing snippet mode with Grok AI');
    } else {
      // Full page mode - fetch HTML
      console.log('📄 Processing full page mode with Grok AI');
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

    // Use Grok AI for fact-checking
    console.log(`🤖 Running Grok AI fact-checking pipeline...`);
    const result = await grokFactCheck(text, isSnippetMode);
    
    const response = NextResponse.json({ url, ...result });
          return addCorsHeaders(response);

  } catch (e: any) {
    console.error("EXTRACT ERROR:", e?.message);
    const msg = String(e?.message || "Server error");
    const status = msg.startsWith("Fetch failed") || msg.includes("readable text") ? 502 : 500;
    const response = NextResponse.json({ error: msg }, { status });
    return addCorsHeaders(response);
  }
}
