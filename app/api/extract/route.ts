import { NextResponse } from "next/server";
import { z } from "zod";
import * as cheerio from "cheerio";
import { generateObject, generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

export const runtime = "nodejs";
export const maxDuration = 30;

const ClaimsSchema = z.object({
  claims: z.array(z.object({
    claim: z.string().min(6),
    quote: z.string().optional(),
    confidence: z.number().min(0).max(1).default(0.5),
  })).max(8),
});

const SnippetClaimsSchema = z.object({
  claims: z.array(z.object({
    claim: z.string().min(6),
    status: z.enum(['likely true', 'likely false', 'uncertain']),
    confidence: z.number().min(0).max(1).default(0.5),
    justification: z.string().min(10),
  })).max(5),
});

async function fetchReadableText(url: string) {
  const res = await fetch(url, {
    headers: { "user-agent": "Verifis/0.1 (+https://verifis.app)" },
    redirect: "follow",
    // @ts-ignore
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const text =
    $("article").text().trim() ||
    $("main").text().trim() ||
    $("body").text().trim();
  if (!text) throw new Error("No readable text found on page");
  return text.replace(/\s+/g, " ").slice(0, 20000);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { url, text: snippetText, isSnippet } = body;
    
    if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Server missing OPENAI_API_KEY" }, { status: 500 });

    let text: string;
    let isSnippetMode = false;

    // Handle snippet mode vs full page mode
    if (isSnippet && snippetText && snippetText.length < 2000) {
      text = snippetText;
      isSnippetMode = true;
    } else {
      // Full page mode - fetch HTML
      text = await fetchReadableText(url);
      isSnippetMode = false;
    }

    const openai = createOpenAI({ apiKey });

    if (isSnippetMode) {
      // Snippet mode: faster, cheaper verification
      const prompt = 
      
`
Verify the factual accuracy of the highlighted snippet below.
- Output a list of 1-3 checkable claims with binary assessments ("likely true", "likely false", "uncertain") 
- Calculate a confidence score 0–1 with two decimal places and a one-sentence justification.
Return JSON only: { "claims": [ { "claim", "status", "confidence", "justification" } ] }.

SNIPPET:
${text}`;

      try {
        const { object } = await generateObject({
          model: openai("gpt-4o-mini"),
          schema: SnippetClaimsSchema,
          prompt,
          temperature: 0.1, // Lower temperature for more consistent verification
        });
        return NextResponse.json({ url, ...object });
      } catch (strictErr: any) {
        console.error("Snippet strict JSON failed:", strictErr?.message);

        // Fallback for snippets
        const { text: raw } = await generateText({
          model: openai("gpt-4o-mini"),
          prompt: prompt + `\nReturn only JSON.`,
          temperature: 0.1,
        });

        try {
          const parsed = JSON.parse(raw);
          const safe = SnippetClaimsSchema.parse(parsed);
          return NextResponse.json({ url, ...safe });
        } catch (fallbackErr: any) {
          console.error("Snippet fallback parse failed:", fallbackErr?.message, "LLM raw:", raw?.slice(0, 800));
          return NextResponse.json({ error: "Snippet verification failed (JSON parse). Check logs." }, { status: 500 });
        }
      }
    } else {
      // Full page mode: standard claim extraction
      const prompt = 
      
`
Extract up to 8 atomic, checkable factual claims from the page text below.
- One sentence per claim.
- Prefer concrete numbers, definitions, product specs, health effects.
- Avoid opinions or vague advice.
- If an exact supporting snippet is obvious, include it as "quote".
Return ONLY a JSON object with { "claims": [{ "claim": string, "quote"?: string, "confidence": number }] }.

PAGE TEXT:
${text}`;

      // strict path
      try {
        const { object } = await generateObject({
          model: openai("gpt-4o-mini"),
          schema: ClaimsSchema,
          prompt,
          temperature: 0.2,
        });

        return NextResponse.json({ url, ...object });
      } catch (strictErr: any) {
        console.error("Strict JSON failed:", strictErr?.message);

        // fallback: loose JSON parse
        const { text: raw } = await generateText({
          model: openai("gpt-4o-mini"),
          prompt: prompt + `\nReturn only JSON.`,
          temperature: 0.2,
        });

        try {
          const parsed = JSON.parse(raw);
          const safe = ClaimsSchema.parse(parsed);
          return NextResponse.json({ url, ...safe });
        } catch (fallbackErr: any) {
          console.error("Fallback parse failed:", fallbackErr?.message, "LLM raw:", raw?.slice(0, 800));
          return NextResponse.json({ error: "Claim extraction failed (JSON parse). Check logs." }, { status: 500 });
        }
      }
    }
  } catch (e: any) {
    console.error("EXTRACT ERROR:", e?.message);
    const msg = String(e?.message || "Server error");
    const status = msg.startsWith("Fetch failed") || msg.includes("readable text") ? 502 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}


