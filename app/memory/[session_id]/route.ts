import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memora/store';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ session_id: string }> }
) {
  try {
    const { session_id } = await params;
    const memories = memoryStore.getMemoriesBySession(session_id, 10);
    return NextResponse.json({ memories });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Error' }, { status: 500 });
  }
}
