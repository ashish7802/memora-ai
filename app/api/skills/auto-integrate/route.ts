import { NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memora/store';

export async function POST() {
  try {
    const integrated = memoryStore.autoIntegrate(0.8);
    return NextResponse.json({
      status: 'success',
      message: `Auto-integration check completed. ${integrated.length} skills integrated.`,
      count: integrated.length,
      integrated_skills: integrated,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Error' }, { status: 500 });
  }
}
