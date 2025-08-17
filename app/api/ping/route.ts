import { NextResponse } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

export const runtime = "nodejs";

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ ok: false, error: "OPENAI_API_KEY missing" }, { status: 500 });

    const openai = createOpenAI({ apiKey });
    const model = openai("gpt-3.5-turbo");
    
    // Use the ai package's generateText function
    const { text } = await generateText({
      model,
      prompt: "Say OK",
      temperature: 0
    });
    
    return NextResponse.json({ ok: true, reply: text });
  } catch (e: any) {
    console.error("Ping error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Model error" }, { status: 500 });
  }
}
