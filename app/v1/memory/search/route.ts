import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memora/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const topKParam = searchParams.get('top_k') || searchParams.get('topK') || '10';
    const topK = parseInt(topKParam, 10) || 10;

    if (!q.trim()) {
      const all = memoryStore.getAllMemories();
      return NextResponse.json({ results: all, count: all.length });
    }

    const scored = await memoryStore.searchMemory(q.trim(), topK);
    const results = scored.map((item) => ({
      id: item.id,
      text: item.text,
      metadata: item.metadata || {},
      distance: item.distance,
      score: typeof item.distance === 'number' ? Number((1 - item.distance).toFixed(4)) : 0.85,
      created_at: item.metadata?.timestamp || new Date().toISOString(),
    }));

    return NextResponse.json({ results, count: results.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Search failed', results: [] }, { status: 500 });
  }
}
