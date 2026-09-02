import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memora/store';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ session_id: string }> }
) {
  try {
    const { session_id } = await params;
    const experiences = memoryStore.getExperiencesBySession(session_id);
    return NextResponse.json({
      session_id,
      experiences,
      count: experiences.length,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Error' }, { status: 500 });
  }
}
