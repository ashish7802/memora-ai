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
