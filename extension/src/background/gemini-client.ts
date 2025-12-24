import { getGeminiApiKey } from "../storage/settings";
import { MAX_CLAIMS, MAX_SOURCES, MAX_SELECTION_CHARS } from "../constants";
import type { FactcheckResponse, Claim, Source, ExplainResponse } from "../types";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent";

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message: string;
  };
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }

  const data: GeminiResponse = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("No response from Gemini");
  }

  return text.trim();
}

async function extractClaims(
  text: string,
  apiKey: string
): Promise<string[]> {
  const prompt = `You are a factual claim extractor. Your task is to extract 1-${MAX_CLAIMS} concise, factual claims from the text below.

Rules:
- Extract only factual, verifiable claims (statements that can be checked against sources)
- Do NOT extract opinions, speculation, or questions
- Each claim should be a complete, standalone sentence
- Claims should be specific and clear
- If the text contains no factual claims, return an empty array
- Output ONLY a valid JSON array of strings, nothing else

Text to analyze:
${text}

Output format: ["claim 1", "claim 2", ...]`;

  try {
    const response = await callGemini(prompt, apiKey);

    // Try to extract JSON array from response
    let jsonText = response;
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    const claims = JSON.parse(jsonText);
    if (!Array.isArray(claims)) {
      return [];
    }

    return claims
      .filter((c) => typeof c === "string" && c.trim().length > 0)
      .map((c) => c.trim())
      .slice(0, MAX_CLAIMS);
  } catch (error) {
    console.error("Claim extraction error:", error);
    throw new Error(
      `Failed to extract claims: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

async function fetchSources(
  claim: string,
  apiKey: string
): Promise<Source[]> {
  const prompt = `You are a source finder for fact-checking. For the following claim, suggest up to ${MAX_SOURCES} credible sources that could verify or refute it.

Claim: "${claim}"

For each source, provide:
- title: A plausible article title
- url: A realistic URL (prefer .gov, .edu, major news outlets like reuters.com, apnews.com, bbc.com)
- snippet: A 2-3 sentence excerpt that would be relevant to the claim
- domain: The source domain
- confidence: A number 0-100 indicating source relevance
- stance: "supports", "contradicts", or "unclear"

Output ONLY a valid JSON array of source objects, nothing else.

Format:
[{"title": "...", "url": "https://...", "snippet": "...", "domain": "...", "confidence": 85, "stance": "supports"}]`;

  try {
    const response = await callGemini(prompt, apiKey);

    let jsonText = response;
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    const sources = JSON.parse(jsonText);
    if (!Array.isArray(sources)) {
      return [];
    }

    return sources
      .filter(
        (s) =>
          s &&
          typeof s.title === "string" &&
          typeof s.url === "string" &&
          typeof s.snippet === "string"
      )
      .map((s) => ({
        title: s.title,
        url: s.url,
        snippet: s.snippet,
        domain: s.domain || new URL(s.url).hostname,
        confidence: typeof s.confidence === "number" ? s.confidence : 70,
        stance: ["supports", "contradicts", "unclear"].includes(s.stance)
          ? s.stance
          : "unclear",
      }))
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
      .slice(0, MAX_SOURCES);
  } catch (error) {
    console.error("Source fetching error:", error);
    return [];
  }
}

export async function factcheckTextWithGemini(
  text: string
): Promise<FactcheckResponse> {
  const apiKey = await getGeminiApiKey();

  if (!apiKey) {
    throw new Error(
      "Gemini API key not configured. Please set your API key in the extension settings."
    );
  }

  const truncated = text.length > 1200;
  const processedText = truncated ? text.substring(0, 1200) : text;

  // Extract claims
  const claimTexts = await extractClaims(processedText, apiKey);

  if (claimTexts.length === 0) {
    return {
      claims: [],
      meta: { truncated },
    };
  }

  // Fetch sources for each claim
  const claims: Claim[] = await Promise.all(
    claimTexts.map(async (claimText) => {
      const sources = await fetchSources(claimText, apiKey);
      return {
        claim: claimText,
        sources,
      };
    })
  );

  return {
    claims,
    meta: { truncated },
  };
}

async function generateExplanation(
  text: string,
  apiKey: string
): Promise<{ background: string; simpleSummary: string }> {
  const prompt = `You are an educational explainer helping readers understand complex text. Analyze the following text and provide:

1. **Background**: Provide 2-4 sentences of contextual background that helps understand this text. Include relevant historical, scientific, political, or cultural context as appropriate.

2. **Simple Summary**: Rewrite the main idea in 1-2 sentences using simple, everyday language that anyone could understand. Avoid jargon entirely.

Text to analyze:
"""
${text}
"""

Output ONLY valid JSON in this exact format, nothing else:
{
  "background": "Contextual background information...",
  "simpleSummary": "Simple explanation of the main idea..."
}`;

  try {
    const response = await callGemini(prompt, apiKey);

    // Try to extract JSON object from response
    let jsonText = response;
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonText);

    return {
      background: typeof parsed.background === "string" ? parsed.background : "",
      simpleSummary: typeof parsed.simpleSummary === "string" ? parsed.simpleSummary : "",
    };
  } catch (error) {
    console.error("Explanation generation error:", error);
    throw new Error(
      `Failed to generate explanation: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export async function explainTextWithGemini(
  text: string
): Promise<ExplainResponse> {
  const apiKey = await getGeminiApiKey();

  if (!apiKey) {
    throw new Error(
      "Gemini API key not configured. Please set your API key in the extension settings."
    );
  }

  const truncated = text.length > MAX_SELECTION_CHARS;
  const processedText = truncated ? text.substring(0, MAX_SELECTION_CHARS) : text;

  const result = await generateExplanation(processedText, apiKey);

  return {
    ...result,
    meta: { truncated },
  };
}
