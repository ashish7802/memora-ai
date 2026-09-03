import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memora/store';

export async function GET(req: NextRequest) {
  const backendUrl = process.env.MEMORA_BACKEND_URL || 'http://localhost:8000';
  const apiKey = process.env.MEMORA_API_KEY || '';

  try {
    const res = await fetch(`${backendUrl}/v1/memory/stats`, {
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      },
      cache: 'no-store',
    });

    if (res.ok) {
      const stats = await res.json();
      return NextResponse.json(stats);
    }
  } catch {
    // Fallback to local store
  }

  const localStats = memoryStore.getStats();
  return NextResponse.json(localStats);
}

