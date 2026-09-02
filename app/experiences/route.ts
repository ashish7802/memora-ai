import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memora/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const experiences = memoryStore.getRecentExperiences(limit);
    return NextResponse.json({
      experiences,
      count: experiences.length,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Error' }, { status: 500 });
  }
}
