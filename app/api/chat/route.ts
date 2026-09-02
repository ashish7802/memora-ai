import { NextRequest, NextResponse } from 'next/server';
import { runOrchestrator } from '@/lib/memora/orchestrator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body.message || '';
    const sessionId = body.session_id || 'default';

    if (!message) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    const result = await runOrchestrator(message, sessionId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Chat error' }, { status: 500 });
  }
}
