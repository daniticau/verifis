import { extractClaims } from "./gemini";
import { fetchSources } from "./gemini-search";
import { MAX_CLAIMS, MAX_SOURCES } from "./types";
import type { FactcheckResponse, Claim } from "@verifis/shared-types";
import { validateAndTruncateText } from "./schema";

export async function factcheckText(text: string): Promise<FactcheckResponse> {
  // Validate and truncate
  const processedText = validateAndTruncateText(text);
  const truncated = text.length > processedText.length;

  try {
    // Extract claims using Gemini
    const claimTexts = await extractClaims({
      text: processedText,
      maxClaims: MAX_CLAIMS,
    });

    if (claimTexts.length === 0) {
      return {
        claims: [],
        meta: { truncated },
      };
    }

    // For each claim, fetch sources using Gemini search
    const claims: Claim[] = await Promise.all(
      claimTexts.map(async (claimText) => {
        const sources = await fetchSources(claimText, {
          maxSources: MAX_SOURCES,
        });

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
  } catch (error) {
    // Return error in meta so extension can display it
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Factcheck error:", error);
    return {
      claims: [],
      meta: {
        truncated,
        error: errorMessage,
      },
    };
  }
}

