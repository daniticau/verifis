import { NextRequest, NextResponse } from 'next/server';
import { FeedbackSchema, type FeedbackRequest } from '@/lib/schema';

// TODO: Swap for persistent storage (Supabase/SQLite) after v0
const feedbackStore: FeedbackRequest[] = [];

export async function POST(req: NextRequest) {
	try {
		const json = await req.json();
		const parsed = FeedbackSchema.safeParse(json);
		if (!parsed.success) {
			return NextResponse.json({ error: 'Invalid feedback payload' }, { status: 400 });
		}
		feedbackStore.push(parsed.data);
		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json({ error: 'Invalid feedback payload' }, { status: 400 });
	}
}


