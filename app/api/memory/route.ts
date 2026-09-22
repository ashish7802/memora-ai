import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memora/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id') || searchParams.get('sessionId');

    if (sessionId) {
      const memories = memoryStore.getMemoriesBySession(sessionId, 25);
      return NextResponse.json({ memories, count: memories.length });
    }

    const memories = memoryStore.getAllMemories();
    return NextResponse.json({ memories, count: memories.length, results: memories });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to get memories' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = body.text || '';
    const metadata = body.metadata || {};

    if (!text.trim()) {
      return NextResponse.json({ error: 'Text is required to create a memory' }, { status: 400 });
    }

    const id = await memoryStore.addMemory(text.trim(), metadata);
    return NextResponse.json({ id, text: text.trim(), metadata, status: 'success' }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to add memory' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Memory ID is required' }, { status: 400 });
    }

    const deleted = memoryStore.deleteMemory(id);
    return NextResponse.json({ success: deleted, id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete memory' }, { status: 500 });
  }
}
