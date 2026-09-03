import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memora/store';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ session_id: string }> }
) {
  const backendUrl = process.env.MEMORA_BACKEND_URL || 'http://localhost:8000';
  const apiKey = process.env.MEMORA_API_KEY || '';

  try {
    const { session_id } = await params;

    const res = await fetch(`${backendUrl}/v1/learning/logs/${session_id}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      },
      cache: 'no-store',
    });

    if (res.ok) {
      const logs = await res.json();
      const userModel = {
        session_id,
        total_interactions: logs.length,
        frequent_tools: [...new Set(logs.map((l: any) => l.tool_used).filter(Boolean))],
        recent_queries: logs.slice(0, 5).map((l: any) => l.user_query),
        success_rate: logs.length > 0 ? logs.filter((l: any) => l.success).length / logs.length : 1.0,
      };

      return NextResponse.json({
        status: 'success',
        session_id,
        user_model: userModel,
      });
    }
  } catch {
    // Fallback to local store
  }

  try {
    const { session_id } = await params;
    const model = memoryStore.buildUserModelFromExperiences(session_id);
    return NextResponse.json({
      status: 'success',
      session_id,
      user_model: model,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Error' }, { status: 500 });
  }
}

