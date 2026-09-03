// ⚠️ KNOWN LIMITATION (Phase 1): This route reads from the legacy in-memory
// `memoryStore` (lib/memora/store.ts), which is DISCONNECTED from the new
// Postgres-backed /v1/memory engine. Data shown here does NOT reflect memories
// added via the new backend. Full migration planned for Phase 3/5.

import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memora/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const proposals = memoryStore.getProposals(status);
    return NextResponse.json({
      status: 'success',
      count: proposals.length,
      proposals,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Error fetching proposals' }, { status: 500 });
  }
}
