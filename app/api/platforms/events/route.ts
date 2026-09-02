import { NextRequest, NextResponse } from 'next/server';
import { platformManager, PlatformType } from '@/lib/memora/platforms';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const platform = (searchParams.get('platform') as PlatformType) || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;

    const logs = platformManager.getLogs(platform, limit);
    return NextResponse.json({ status: 'success', logs, total: logs.length });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    platformManager.clearLogs();
    return NextResponse.json({ status: 'success', message: 'Platform event logs cleared' });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
  }
}
