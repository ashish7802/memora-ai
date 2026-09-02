import { NextRequest, NextResponse } from 'next/server';
import { platformManager } from '@/lib/memora/platforms';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const result = await platformManager.handleDiscordInteraction(payload);
    return NextResponse.json(result.response);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    platform: 'Discord Interaction / Webhook Receiver',
    endpoint: '/api/platforms/discord/webhook',
  });
}
