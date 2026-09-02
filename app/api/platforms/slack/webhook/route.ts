import { NextRequest, NextResponse } from 'next/server';
import { platformManager } from '@/lib/memora/platforms';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let body: any = {};

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      const entries: Record<string, any> = {};
      formData.forEach((val, key) => {
        entries[key] = val;
      });
      body = entries;
    } else {
      body = await req.json().catch(() => ({}));
    }

    const result = await platformManager.handleSlackEvent(body);
    return NextResponse.json(result.response);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    platform: 'Slack Events / Slash Command Receiver',
    endpoint: '/api/platforms/slack/webhook',
  });
}
