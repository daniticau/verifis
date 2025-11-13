import "./config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { MAX_CLAIMS } from "./types";

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is required");
}

const genAI = new GoogleGenerativeAI(API_KEY);
// Use gemini-2.0-flash-exp (experimental, widely available)
// Can be overridden with GEMINI_MODEL env var
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

export async function extractClaims(input: {
  text: string;
  maxClaims: number;
}): Promise<string[]> {
  const prompt = `You are a factual claim extractor. Your task is to extract 1-${input.maxClaims} concise, factual claims from the text below.

Rules:
- Extract only factual, verifiable claims (statements that can be checked against sources)
- Do NOT extract opinions, speculation, or questions
- Each claim should be a complete, standalone sentence
- Claims should be specific and clear
- If the text contains no factual claims, return an empty array
- Output ONLY a valid JSON array of strings, nothing else

Text to analyze:
${input.text}

Output format: ["claim 1", "claim 2", ...]`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    // Try to extract JSON array from response
    // Sometimes Gemini wraps the JSON in markdown code blocks
    let jsonText = text;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    const claims = JSON.parse(jsonText);
    if (!Array.isArray(claims)) {
      return [];
    }

    // Filter and validate claims
    return claims
      .filter((c) => typeof c === "string" && c.trim().length > 0)
      .map((c) => c.trim())
      .slice(0, input.maxClaims);
  } catch (error) {
    console.error("Gemini API error:", error);
    // Re-throw with more context for better error handling upstream
    if (error instanceof Error) {
      throw new Error(`Failed to extract claims: ${error.message}`);
    }
    throw new Error("Failed to extract claims: Unknown error");
  }
}

export async function classifySourceStance(
  claim: string,
  sourceSnippet: string
): Promise<"supports" | "contradicts" | "unclear"> {
  const prompt = `Given the following claim and a source excerpt, classify whether the source supports, contradicts, or is unclear about the claim.

Claim: ${claim}

Source excerpt: ${sourceSnippet}

Respond with ONLY one word: "supports", "contradicts", or "unclear"`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim().toLowerCase();

    if (text.includes("supports")) {
      return "supports";
    } else if (text.includes("contradicts")) {
      return "contradicts";
    } else {
      return "unclear";
    }
  } catch (error) {
    console.error("Gemini stance classification error:", error);
    return "unclear";
  }
}

