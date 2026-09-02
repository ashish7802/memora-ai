import { NextRequest, NextResponse } from 'next/server';
import { executeSwarmPlan, executeWorkerTask, swarmStore } from '@/lib/memora/swarm';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { plan_id, task_id } = body;

    if (!plan_id) {
      return NextResponse.json({ error: 'plan_id is required' }, { status: 400 });
    }

    const plan = swarmStore.getPlan(plan_id);
    if (!plan) {
      return NextResponse.json({ error: `Plan ${plan_id} not found` }, { status: 404 });
    }

    if (task_id) {
      // Execute a specific individual task
      const task = plan.tasks.find((t) => t.id === task_id);
      if (!task) {
        return NextResponse.json({ error: `Task ${task_id} not found in plan` }, { status: 404 });
      }
      const updatedTask = await executeWorkerTask(task, plan);
      swarmStore.savePlan(plan);
      return NextResponse.json({ status: 'success', task: updatedTask, plan });
    }

    // Execute the full swarm plan in parallel / topological dependency order
    const completedPlan = await executeSwarmPlan(plan_id);
    return NextResponse.json({ status: 'success', plan: completedPlan });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Execution failed' }, { status: 500 });
  }
}
