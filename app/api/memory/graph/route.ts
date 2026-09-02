import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memora/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const minSimParam = searchParams.get('min_similarity');
    const minSimilarity = minSimParam ? parseFloat(minSimParam) : 0.2;

    const graph = await memoryStore.getSemanticGraph(minSimilarity);
    return NextResponse.json(graph);
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message || 'Failed to generate semantic graph' },
      { status: 500 }
    );
  }
}
