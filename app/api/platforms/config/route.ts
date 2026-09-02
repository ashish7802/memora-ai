import { NextRequest, NextResponse } from 'next/server';
import { platformManager } from '@/lib/memora/platforms';

export async function GET() {
  try {
    const rawConfig = platformManager.getConfig();

    // Mask sensitive tokens for client safety
    const safeConfig = {
      telegram: {
        ...rawConfig.telegram,
        botToken: rawConfig.telegram.botToken
          ? `${rawConfig.telegram.botToken.slice(0, 6)}...${rawConfig.telegram.botToken.slice(-4)}`
          : '',
      },
      discord: {
        ...rawConfig.discord,
        botToken: rawConfig.discord.botToken
          ? `${rawConfig.discord.botToken.slice(0, 8)}...${rawConfig.discord.botToken.slice(-4)}`
          : '',
        webhookUrl: rawConfig.discord.webhookUrl
          ? `${rawConfig.discord.webhookUrl.slice(0, 32)}...`
          : '',
      },
      slack: {
        ...rawConfig.slack,
        botToken: rawConfig.slack.botToken
          ? `${rawConfig.slack.botToken.slice(0, 8)}...${rawConfig.slack.botToken.slice(-4)}`
          : '',
        webhookUrl: rawConfig.slack.webhookUrl
          ? `${rawConfig.slack.webhookUrl.slice(0, 32)}...`
          : '',
      },
    };

    return NextResponse.json({
      status: 'success',
      config: safeConfig,
      rawKeysPresent: {
        telegram: Boolean(rawConfig.telegram.botToken),
        discord: Boolean(rawConfig.discord.webhookUrl),
        slack: Boolean(rawConfig.slack.webhookUrl),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = platformManager.updateConfig(body);
    return NextResponse.json({ status: 'success', message: 'Platform configurations updated', config: updated });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
  }
}
