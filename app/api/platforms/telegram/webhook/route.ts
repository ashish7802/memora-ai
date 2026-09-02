import { NextRequest, NextResponse } from 'next/server';
import { platformManager } from '@/lib/memora/platforms';

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();
    const result = await platformManager.handleTelegramUpdate(update);
    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    platform: 'Telegram Bot Webhook Receiver',
    endpoint: '/api/platforms/telegram/webhook',
  });
}
