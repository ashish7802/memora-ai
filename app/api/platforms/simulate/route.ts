import { NextRequest, NextResponse } from 'next/server';
import { platformManager, PlatformType } from '@/lib/memora/platforms';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { platform, text, action } = body;

    // Handle cross-platform broadcast test
    if (action === 'broadcast') {
      const { title, message } = body;
      const res = await platformManager.broadcastNotification(
        title || 'Swarm Milestone',
        message || 'Hermes multi-agent synthesis verified across platforms.'
      );
      return NextResponse.json({ status: 'success', broadcast: res });
    }

    if (!platform || !text) {
      return NextResponse.json(
        { status: 'error', error: 'platform and text are required' },
        { status: 400 }
      );
    }

    let result: any = null;

    if (platform === 'telegram') {
      const mockUpdate = {
        update_id: Math.floor(Math.random() * 100000),
        message: {
          message_id: Math.floor(Math.random() * 5000),
          from: {
            id: 981240,
            is_bot: false,
            first_name: 'Alex',
            username: 'alex_ops',
          },
          chat: {
            id: -10023456789,
            title: 'Memora Ops Telegram',
            type: 'supergroup',
          },
          date: Math.floor(Date.now() / 1000),
          text: text.trim(),
        },
      };
      result = await platformManager.handleTelegramUpdate(mockUpdate);
    } else if (platform === 'discord') {
      const mockPayload = {
        type: 2, // Application command
        command: text.startsWith('/') ? text.slice(1).split(' ')[0] : 'memora',
        content: text.startsWith('/') ? text.slice(1) : text,
        member: {
          user: {
            id: '123456789012345678',
            username: 'sarah_dev',
            discriminator: '0001',
          },
        },
        channel_id: '112233445566778899',
      };
      result = await platformManager.handleDiscordInteraction(mockPayload);
    } else if (platform === 'slack') {
      const mockBody = {
        command: '/memora',
        text: text.replace(/^\/memora\s*/i, '').trim(),
        user_name: 'alex_lead',
        user_id: 'U98765432',
        channel_name: 'ai-memora-ops',
      };
      result = await platformManager.handleSlackEvent(mockBody);
    } else {
      return NextResponse.json(
        { status: 'error', error: `Unsupported platform: ${platform}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      status: 'success',
      platform,
      input: text,
      result,
    });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
  }
}
