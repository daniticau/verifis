import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const runtime = "nodejs";

async function fetchText(url: string) {
  const res = await fetch(url, {
    headers: { "user-agent": "Verifis/0.1 (+https://verifis.app)" },
    redirect: "follow",
    // @ts-ignore
    cache: "no-store"
  });
  const status = res.status;
  const ok = res.ok;
  const html = await res.text();
  const $ = cheerio.load(html);
  const text =
    $("article").text().trim() ||
    $("main").text().trim() ||
    $("body").text().trim();
  return { ok, status, size: html.length, textPreview: text.slice(0, 400) };
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });
    const out = await fetchText(url);
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Diag error" }, { status: 500 });
  }
}
