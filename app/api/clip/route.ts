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

// Helper function to add CORS headers
function addCorsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

export async function OPTIONS() {
  return addCorsHeaders(new NextResponse(null, { status: 200 }));
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = ClipSchema.safeParse(json);
    
    if (!parsed.success) {
      const response = NextResponse.json({ error: 'Invalid clip data' }, { status: 400 });
      return addCorsHeaders(response);
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

    const response = NextResponse.json({ 
      id: clipId,
      message: 'Clip created successfully'
    });
    return addCorsHeaders(response);

  } catch (error) {
    console.error('Clip creation error:', error);
    const response = NextResponse.json({ error: 'Failed to create clip' }, { status: 500 });
    return addCorsHeaders(response);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clipId = searchParams.get('id');
    
    if (!clipId) {
      const response = NextResponse.json({ error: 'Missing clip ID' }, { status: 400 });
      return addCorsHeaders(response);
    }

    const clip = clipStore.get(clipId);
    if (!clip) {
      const response = NextResponse.json({ error: 'Clip not found' }, { status: 404 });
      return addCorsHeaders(response);
    }

    const response = NextResponse.json(clip);
    return addCorsHeaders(response);

  } catch (error) {
    console.error('Clip retrieval error:', error);
    const response = NextResponse.json({ error: 'Failed to retrieve clip' }, { status: 500 });
    return addCorsHeaders(response);
  }
}
