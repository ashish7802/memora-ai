import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memora/store';

export async function GET(_req: NextRequest) {
  try {
    const stats = memoryStore.getStats();
    return NextResponse.json({ ...stats, status: 'online' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, count: 0 }, { status: 500 });
  }
}
