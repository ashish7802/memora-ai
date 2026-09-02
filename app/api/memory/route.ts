import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memora/store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = body.text || '';
    const metadata = body.metadata || {};

    if (!text) {
      return NextResponse.json({ detail: 'Memory text cannot be empty' }, { status: 400 });
    }

    const id = await memoryStore.addMemory(text, metadata);
    return NextResponse.json({ id, status: 'success' });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Error adding memory' }, { status: 500 });
  }
}

export async function GET() {
  const memories = memoryStore.getAllMemories();
  return NextResponse.json({ memories });
}
