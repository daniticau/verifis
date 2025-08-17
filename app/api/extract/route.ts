import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { extractReadableText, fetchHtml } from '@/lib/html';
import { ClaimsSchema } from '@/lib/schema';
import { getOpenAI } from '@/lib/models';
import { generateObject } from 'ai';

const BodySchema = z.object({ url: z.string().url() });

export async function POST(req: NextRequest) {
	let url: string;
	try {
		const json = await req.json();
		const parsed = BodySchema.safeParse(json);
		if (!parsed.success) {
			return NextResponse.json({ error: 'Missing or invalid url' }, { status: 400 });
		}
		url = parsed.data.url;
	} catch {
		return NextResponse.json({ error: 'Missing or invalid url' }, { status: 400 });
	}

	let html: string;
	try {
		html = await fetchHtml(url);
	} catch (err: any) {
		const status = typeof err?.status === 'number' ? err.status : 0;
		return NextResponse.json(
			{ error: `Couldn't fetch that page (HTTP ${status || 'error'}). Try another URL.` },
			{ status: 502 }
		);
	}

	const text = extractReadableText(html);
	const prompt = [
		'Extract up to 8 atomic, checkable factual claims from the page text below.',
		'- One sentence per claim.',
		'- Prefer concrete numbers, definitions, product specs, health effects.',
		'- Avoid opinions or vague advice.',
		'- If an exact supporting snippet is obvious, include it as "quote".',
		'Return ONLY a JSON object matching the provided schema.',
		'',
		'PAGE TEXT:',
		text,
	].join('\n');

	try {
		const openai = getOpenAI();
		const model = openai('gpt-4o-mini');
		const { object } = await generateObject({
			model,
			schema: ClaimsSchema,
			prompt,
		});

		return NextResponse.json({ url, claims: object.claims });
	} catch (err: any) {
		const message = typeof err?.message === 'string' ? err.message : 'Claim extraction failed. Please try again.';
		const isMissingKey = message.includes('OPENAI_API_KEY');
		return NextResponse.json(
			{ error: isMissingKey ? 'Missing OPENAI_API_KEY environment variable' : 'Claim extraction failed. Please try again.' },
			{ status: 500 }
		);
	}
}


