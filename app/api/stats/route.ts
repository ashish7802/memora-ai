import { NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memora/store';

export async function GET() {
  const stats = memoryStore.getStats();
  return NextResponse.json(stats);
}
