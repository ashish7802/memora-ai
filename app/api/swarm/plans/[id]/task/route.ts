import { NextRequest, NextResponse } from 'next/server';
import { swarmStore, TaskStatus } from '@/lib/memora/swarm';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { task_id, status } = body;

    if (!task_id || !status) {
      return NextResponse.json({ error: 'task_id and status are required' }, { status: 400 });
    }

    const validStatuses: TaskStatus[] = ['backlog', 'in_progress', 'review', 'completed', 'failed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }

    const updatedTask = swarmStore.updateTaskStatus(id, task_id, status);
    if (!updatedTask) {
      return NextResponse.json({ error: 'Plan or task not found' }, { status: 404 });
    }

    const plan = swarmStore.getPlan(id);
    return NextResponse.json({ status: 'success', task: updatedTask, plan });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
