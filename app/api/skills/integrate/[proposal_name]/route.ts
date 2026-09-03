// ⚠️ KNOWN LIMITATION (Phase 1): This route reads from the legacy in-memory
// `memoryStore` (lib/memora/store.ts), which is DISCONNECTED from the new
// Postgres-backed /v1/memory engine. Data shown here does NOT reflect memories
// added via the new backend. Full migration planned for Phase 3/5.

import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memora/store';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ proposal_name: string }> }
) {
  try {
    const { proposal_name } = await params;
    const proposal = memoryStore.getProposal(proposal_name);
    if (!proposal) {
      return NextResponse.json(
        { detail: `Proposal '${proposal_name}' not found.` },
        { status: 404 }
      );
    }

    const success = memoryStore.integrateProposal(proposal_name);
    if (!success) {
      return NextResponse.json(
        { detail: `Failed to integrate skill '${proposal_name}'.` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'success',
      message: `Skill '${proposal_name}' successfully integrated into SkillRegistry.`,
      skill_name: proposal_name,
      proposal,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Error' }, { status: 500 });
  }
}
