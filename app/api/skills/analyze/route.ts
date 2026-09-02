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
