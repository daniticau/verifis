import "./config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Source } from "@verifis/shared-types";
import { MAX_SOURCES } from "./types";

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is required");
}

const genAI = new GoogleGenerativeAI(API_KEY);
// Use gemini-2.0-flash-exp (experimental, widely available)
// Can be overridden with GEMINI_MODEL env var
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

interface GeminiSourceResult {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  confidence?: number;
}

export async function fetchSources(
  claim: string,
  opts: { maxSources: number }
): Promise<Source[]> {
  const prompt = `You are a fact-checking assistant. For the following factual claim, provide ${opts.maxSources} reliable sources that could verify or provide context for this claim.

Claim: ${claim}

For each source, provide:
- title: A descriptive title for the source
- url: A realistic URL format (e.g., https://example.com/article-title)
- snippet: A brief excerpt or summary (2-3 sentences) explaining what the source says about this claim
- domain: The domain name extracted from the URL
- confidence: A number between 0 and 1 indicating how relevant/reliable this source is for verifying the claim

Prefer sources from:
- Government websites (.gov)
- Educational institutions (.edu)
- Reputable news organizations (Reuters, AP, BBC, etc.)
- Academic or research institutions
- Established fact-checking organizations

Output ONLY a valid JSON array of objects with this exact structure:
[
  {
    "title": "Source Title",
    "url": "https://example.com/article",
    "snippet": "Brief description...",
    "domain": "example.com",
    "confidence": 0.85
  }
]

Do not include any markdown formatting, code blocks, or additional text. Only output the JSON array.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    // Extract JSON array from response
    let jsonText = text;
    // Remove markdown code blocks if present
    jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    // Find JSON array
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    const sources: GeminiSourceResult[] = JSON.parse(jsonText);
    if (!Array.isArray(sources)) {
      console.error("Gemini search returned non-array response");
      return [];
    }

    // Validate and map to Source objects
    const validSources: Source[] = sources
      .slice(0, opts.maxSources)
      .filter((s) => {
        return (
          s &&
          typeof s.title === "string" &&
          typeof s.url === "string" &&
          typeof s.snippet === "string"
        );
      })
      .map((s) => {
        let domain = s.domain;
        if (!domain && s.url) {
          try {
            const urlObj = new URL(s.url);
            domain = urlObj.hostname.replace("www.", "");
          } catch {
            domain = "unknown";
          }
        }

        // Normalize confidence: if > 1, assume it's a percentage and convert to 0-1 range
        let confidence = s.confidence;
        if (typeof confidence === "number") {
          if (confidence > 1) {
            confidence = confidence / 100;
          }
          // Clamp to 0-1 range
          confidence = Math.max(0, Math.min(1, confidence));
        }

        return {
          title: s.title || "Untitled",
          url: s.url,
          snippet: s.snippet.substring(0, 300) || "",
          domain: domain || "unknown",
          confidence: typeof confidence === "number" ? confidence : undefined,
        };
      });

    // Sort by confidence if available, otherwise by domain preference
    validSources.sort((a, b) => {
      if (a.confidence !== undefined && b.confidence !== undefined) {
        return b.confidence - a.confidence;
      }
      // Prefer .gov, .edu domains
      const preferredPatterns = [/\.gov$/, /\.edu$/];
      const aPreferred = preferredPatterns.some((p) => p.test(a.domain));
      const bPreferred = preferredPatterns.some((p) => p.test(b.domain));
      if (aPreferred && !bPreferred) return -1;
      if (!aPreferred && bPreferred) return 1;
      return 0;
    });

    return validSources.slice(0, opts.maxSources);
  } catch (error) {
    console.error("Gemini search API error:", error);
    // Return empty array on error - fact-checking can continue without sources
    // Log the error but don't throw to allow claims to be shown even without sources
    return [];
  }
}

