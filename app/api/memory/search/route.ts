import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memora/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    if (!q) {
      return NextResponse.json({ detail: 'Query parameter q is required' }, { status: 400 });
    }

    const results = await memoryStore.searchMemory(q, 5);
    return NextResponse.json(results);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Error searching memory' }, { status: 500 });
  }
}
