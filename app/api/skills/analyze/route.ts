import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memora/store';

export async function POST(req: NextRequest) {
  const backendUrl = process.env.MEMORA_BACKEND_URL || 'http://localhost:8000';
  const apiKey = process.env.MEMORA_API_KEY || '';

  try {
    let sessionId: string | undefined;
    try {
      const body = await req.json();
      sessionId = body.session_id;
    } catch {
      // Body optional
    }

    const res = await fetch(`${backendUrl}/v1/learning/mine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      },
      body: JSON.stringify({
        session_id: sessionId,
        min_frequency: 1,
        lookback_limit: 100,
      }),
    });

    if (res.ok) {
      const patterns = await res.json();
      return NextResponse.json({
        status: 'success',
        message: `PostgreSQL pattern mining complete. Discovered ${patterns.length} pattern clusters.`,
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

  const proposals = memoryStore.getProposals();
  return NextResponse.json({
    status: 'success',
    message: `Analysis complete. Generated/updated ${proposals.length} proposals.`,
    count: proposals.length,
    proposals,
  });
}

