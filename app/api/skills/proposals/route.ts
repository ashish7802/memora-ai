import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memora/store';

export async function GET(req: NextRequest) {
  const backendUrl = process.env.MEMORA_BACKEND_URL || 'http://localhost:8000';
  const apiKey = process.env.MEMORA_API_KEY || '';

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;

    const res = await fetch(`${backendUrl}/v1/learning/patterns`, {
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      },
      cache: 'no-store',
    });

    if (res.ok) {
      const patterns = await res.json();
      return NextResponse.json({
        status: 'success',
        count: patterns.length,
        proposals: patterns.map((p: any) => ({
          id: p.id,
          name: p.suggested_tool_name || p.title,
          description: p.description,
          category: p.category,
          frequency: p.frequency,
          failure_rate: p.failure_rate,
          status: p.status,
          sample_queries: p.sample_queries,
          created_at: p.created_at,
        })),
      });
    }
  } catch {
    // Fallback to local store
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || undefined;
  const proposals = memoryStore.getProposals(status);
  return NextResponse.json({
    status: 'success',
    count: proposals.length,
    proposals,
  });
}

