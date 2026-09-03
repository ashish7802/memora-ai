// ⚠️ KNOWN LIMITATION (Phase 1): This route reads from the legacy in-memory
// `memoryStore` (lib/memora/store.ts), which is DISCONNECTED from the new
// Postgres-backed /v1/memory engine. Data shown here does NOT reflect memories
// added via the new backend. Full migration planned for Phase 3/5.

import { NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memora/store';

export async function GET() {
  const stats = memoryStore.getStats();
  return NextResponse.json(stats);
}
