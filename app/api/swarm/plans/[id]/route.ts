import { NextRequest, NextResponse } from 'next/server';
import { swarmStore } from '@/lib/memora/swarm';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const plan = swarmStore.getPlan(id);
    if (!plan) {
      return NextResponse.json({ error: `Plan ${id} not found` }, { status: 404 });
    }
    return NextResponse.json({ status: 'success', plan });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = swarmStore.deletePlan(id);
    return NextResponse.json({ status: 'success', deleted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
