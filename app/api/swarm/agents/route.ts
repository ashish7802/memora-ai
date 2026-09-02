import { NextResponse } from 'next/server';
import { WORKER_AGENTS, swarmStore } from '@/lib/memora/swarm';

export async function GET() {
  try {
    const plans = swarmStore.getPlans();

    // Calculate live dynamic counts based on all stored plans
    const agentStats = { ...WORKER_AGENTS };
    Object.values(agentStats).forEach((a) => {
      let completedCount = 0;
      let active = false;

      plans.forEach((p) => {
        p.tasks.forEach((t) => {
          if (t.assignedAgent === a.id) {
            if (t.status === 'completed') completedCount++;
            if (t.status === 'in_progress') active = true;
          }
        });
      });

      a.tasksCompleted = Math.max(a.tasksCompleted, completedCount);
      a.status = active ? 'busy' : 'idle';
    });

    return NextResponse.json({
      status: 'success',
      agents: Object.values(agentStats),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
