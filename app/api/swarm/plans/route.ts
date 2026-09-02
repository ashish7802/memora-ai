import { NextResponse } from 'next/server';
import { swarmStore } from '@/lib/memora/swarm';

export async function GET() {
  try {
    const plans = swarmStore.getPlans();
    return NextResponse.json({ status: 'success', plans, count: plans.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to retrieve plans' }, { status: 500 });
  }
}
