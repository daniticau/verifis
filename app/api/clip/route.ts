import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

// Simple in-memory storage for clips (TODO: replace with database)
const clipStore = new Map<string, any>();
let clipCounter = 0;

const ClipSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  text: z.string().min(1).max(10000), // Max 10k chars for snippets
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = ClipSchema.safeParse(json);
    
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid clip data' }, { status: 400 });
    }

    const { url, title, text } = parsed.data;
    
    // Generate unique clip ID
    const clipId = `clip_${Date.now()}_${clipCounter++}`;
    
    // Store clip data
    clipStore.set(clipId, {
      id: clipId,
      url,
      title,
      text,
      createdAt: new Date().toISOString(),
      isSnippet: text.length < 2000, // Mark as snippet if <2k chars
    });

    // Clean up old clips (keep last 100)
    if (clipStore.size > 100) {
      const entries = Array.from(clipStore.entries());
      const sorted = entries.sort((a, b) => 
        new Date(b[1].createdAt).getTime() - new Date(a[1].createdAt).getTime()
      );
      
      // Remove oldest clips beyond 100
      sorted.slice(100).forEach(([key]) => clipStore.delete(key));
    }

    return NextResponse.json({ 
      id: clipId,
      message: 'Clip created successfully'
    });

  } catch (error) {
    console.error('Clip creation error:', error);
    return NextResponse.json({ error: 'Failed to create clip' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clipId = searchParams.get('id');
    
    if (!clipId) {
      return NextResponse.json({ error: 'Missing clip ID' }, { status: 400 });
    }

    const clip = clipStore.get(clipId);
    if (!clip) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
    }

    return NextResponse.json(clip);

  } catch (error) {
    console.error('Clip retrieval error:', error);
    return NextResponse.json({ error: 'Failed to retrieve clip' }, { status: 500 });
  }
}
