// ⚠️ KNOWN LIMITATION (Phase 1): This route reads from the legacy in-memory
// `memoryStore` (lib/memora/store.ts), which is DISCONNECTED from the new
// Postgres-backed /v1/memory engine. Data shown here does NOT reflect memories
// added via the new backend. Full migration planned for Phase 3/5.

import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memora/store';

export async function POST(req: NextRequest) {
  try {
    let sessionId: string | undefined;
    try {
      const body = await req.json();
      sessionId = body.session_id;
    } catch {
      // Body optional
    }

    const proposals = memoryStore.getProposals();
    return NextResponse.json({
      status: 'success',
      message: `Analysis complete. Generated/updated ${proposals.length} proposals.`,
      count: proposals.length,
      proposals,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Error analyzing skills' }, { status: 500 });
  }
}
