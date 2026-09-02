import { NextRequest, NextResponse } from 'next/server';
import { getEmbedding } from '@/lib/memora/vector';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get('text');
    if (!text) {
      return NextResponse.json({ detail: 'Text parameter is required' }, { status: 400 });
    }

    const embedding = await getEmbedding(text);
    return NextResponse.json({ embedding });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Embedding error' }, { status: 500 });
  }
}
