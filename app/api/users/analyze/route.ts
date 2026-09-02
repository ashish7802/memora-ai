import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memora/store';

export async function POST(req: NextRequest) {
  try {
    let sessionId: string | undefined;
    try {
      const body = await req.json();
      sessionId = body.session_id;
    } catch {
      // Body optional
    }

    if (sessionId) {
      const model = memoryStore.buildUserModelFromExperiences(sessionId);
      return NextResponse.json({
        status: 'success',
        message: `User model analyzed and built for session '${sessionId}'.`,
        user_models: [model],
      });
    }

    const all = memoryStore.getAllUserModels();
    const models = Object.values(all);
    return NextResponse.json({
      status: 'success',
      message: `User models analyzed and updated for ${models.length} sessions.`,
      count: models.length,
      user_models: models,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Error' }, { status: 500 });
  }
}
