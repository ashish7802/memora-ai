import { NextRequest, NextResponse } from 'next/server';
import { decomposeGoal } from '@/lib/memora/swarm';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { goal, session_id = 'default' } = body;

    if (!goal || typeof goal !== 'string' || goal.trim().length === 0) {
      return NextResponse.json({ error: 'Goal description is required' }, { status: 400 });
    }

    const plan = await decomposeGoal(goal.trim(), session_id);
    return NextResponse.json({ status: 'success', plan });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Decomposition failed' }, { status: 500 });
  }
}
