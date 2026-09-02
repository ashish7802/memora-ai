// Multi-Platform Gateway: Telegram, Discord, and Slack Integrations

import { memoryStore } from './store';
import { runOrchestrator } from './orchestrator';
import { decomposeGoal, swarmStore } from './swarm';

export type PlatformType = 'telegram' | 'discord' | 'slack';

export interface PlatformConfig {
  telegram: {
    enabled: boolean;
    botToken: string;
    chatId: string;
    webhookSecret: string;
    autoReply: boolean;
  };
  discord: {
    enabled: boolean;
    botToken: string;
    webhookUrl: string;
    channelId: string;
    enableRichEmbeds: boolean;
  };
  slack: {
    enabled: boolean;
    botToken: string;
    webhookUrl: string;
    signingSecret: string;
    defaultChannel: string;
  };
}

export interface PlatformEventLog {
  id: string;
  platform: PlatformType;
  direction: 'inbound' | 'outbound';
  status: 'success' | 'warning' | 'error';
  eventType: string; // e.g. 'message', 'slash_command', 'swarm_notification', 'webhook'
  sender: string;
  content: string;
  payload?: any;
  response?: any;
  timestamp: string;
  latencyMs: number;
}

class PlatformManager {
  private config: PlatformConfig = {
    telegram: {
      enabled: true,
      botToken: process.env.TELEGRAM_BOT_TOKEN || '789123456:AAFi-MemoraAgentMockTokenXyZ',
      chatId: process.env.TELEGRAM_CHAT_ID || '-10023456789',
      webhookSecret: 'memora_tg_secret_key',
      autoReply: true,
    },
    discord: {
      enabled: true,
      botToken: process.env.DISCORD_BOT_TOKEN || 'MTE5ODc2NTQzMjEw.MemoraMock.DiscordSecretKey',
      webhookUrl:
        process.env.DISCORD_WEBHOOK_URL ||
        'https://discord.com/api/webhooks/123456789/mock-memora-webhook-token',
      channelId: 'memora-agent-feed',
      enableRichEmbeds: true,
    },
    slack: {
      enabled: true,
      botToken: process.env.SLACK_BOT_TOKEN || 'xoxb-mock-memora-slack-bot-token-9988',
      webhookUrl:
        process.env.SLACK_WEBHOOK_URL ||
        'https://hooks.slack.com/services/T000/B000/mockMemoraSlackWebhook',
      signingSecret: 'memora_slack_secret_hash',
      defaultChannel: '#ai-memora-ops',
    },
  };

  private eventLogs: PlatformEventLog[] = [];

  constructor() {
    this.seedInitialEvents();
  }

  private seedInitialEvents() {
    this.eventLogs = [
      {
        id: 'evt-tg-001',
        platform: 'telegram',
        direction: 'inbound',
        status: 'success',
        eventType: 'command',
        sender: '@alex_ops (ID: 981240)',
        content: '/remember User preference is offline-first local Ollama inference',
        response: {
          text: '✅ Memory #mem-921 stored: "User preference is offline-first local Ollama inference"',
        },
        timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
        latencyMs: 142,
      },
      {
        id: 'evt-disc-002',
        platform: 'discord',
        direction: 'outbound',
        status: 'success',
        eventType: 'swarm_notification',
        sender: 'Memora Bot',
        content: 'Hermes Swarm Completed: "Analyze vector retrieval efficiency and compute memory cost"',
        payload: {
          embeds: [
            {
              title: 'Hermes Swarm Synthesis Complete',
              color: 0x588157,
              fields: [
                { name: 'Tasks Completed', value: '5 / 5', inline: true },
                { name: 'Execution Time', value: '14,855 ms', inline: true },
              ],
            },
          ],
        },
        timestamp: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
        latencyMs: 198,
      },
      {
        id: 'evt-slack-003',
        platform: 'slack',
        direction: 'inbound',
        status: 'success',
        eventType: 'slash_command',
        sender: 'U08A1B2C (@sarah)',
        content: '/memora recall quantization benchmarks',
        response: {
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Memora Semantic Recall:*\nFound 2 memories matching `quantization benchmarks` (Similarity > 0.75)',
              },
            },
          ],
        },
        timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
        latencyMs: 165,
      },
    ];
  }

  getConfig(): PlatformConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<PlatformConfig>): PlatformConfig {
    this.config = {
      ...this.config,
      ...updates,
      telegram: { ...this.config.telegram, ...(updates.telegram || {}) },
      discord: { ...this.config.discord, ...(updates.discord || {}) },
      slack: { ...this.config.slack, ...(updates.slack || {}) },
    };
    return { ...this.config };
  }

  getLogs(platformFilter?: PlatformType, limit = 50): PlatformEventLog[] {
    let list = [...this.eventLogs];
    if (platformFilter) {
      list = list.filter((l) => l.platform === platformFilter);
    }
    return list.slice(0, limit);
  }

  clearLogs(): void {
    this.eventLogs = [];
  }

  logEvent(event: Omit<PlatformEventLog, 'id' | 'timestamp'>): PlatformEventLog {
    const newLog: PlatformEventLog = {
      ...event,
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.eventLogs.unshift(newLog);
    if (this.eventLogs.length > 200) {
      this.eventLogs.pop();
    }
    return newLog;
  }

  // ==========================================
  // TELEGRAM BOT HANDLER
  // ==========================================
  async handleTelegramUpdate(update: any): Promise<{ reply: string; data?: any }> {
    const start = Date.now();
    const message = update?.message || update?.edited_message;
    const text = (message?.text || '').trim();
    const sender = message?.from?.username
      ? `@${message.from.username}`
      : `${message?.from?.first_name || 'User'} (${message?.from?.id || 'anon'})`;

    let reply = '';
    let responseData: any = {};

    if (!text) {
      reply = 'Memora Bot received an unsupported message type.';
    } else if (text.startsWith('/start')) {
      reply =
        '👋 Welcome to *Memora AI Agent Bridge*!\n\n' +
        'Available commands:\n' +
        '• `/remember <text>` - Inject memory into semantic vector store\n' +
        '• `/recall <query>` - Retrieve relevant associative memories\n' +
        '• `/swarm <goal>` - Trigger Hermes Multi-Agent Swarm decomposition\n' +
        '• `/stats` - Check platform memory & active plugins\n' +
        '• Or type any query to chat with Memora agent directly!';
    } else if (text.startsWith('/remember')) {
      const memText = text.replace(/^\/remember\s*/i, '').trim();
      if (!memText) {
        reply = '⚠️ Usage: `/remember <information to persist>`';
      } else {
        const memoryId = await memoryStore.addMemory(memText, {
          source: 'Telegram Bot',
          sender,
          category: 'Platform_Sync',
        });
        reply = `🧠 *Memory Stored!* (ID: \`${memoryId}\`)\n"${memText}"\nCosine vector indexed successfully.`;
        responseData = { memoryId };
      }
    } else if (text.startsWith('/recall')) {
      const query = text.replace(/^\/recall\s*/i, '').trim();
      if (!query) {
        reply = '⚠️ Usage: `/recall <search query>`';
      } else {
        const results = await memoryStore.searchMemory(query, 3);
        if (results.length === 0) {
          reply = `🔍 No memories found matching "${query}".`;
        } else {
          reply =
            `🔍 *Memora Associative Memory Recall* for "${query}":\n\n` +
            results
              .map(
                (r, i) =>
                  `${i + 1}. *[#${r.id}]* (Sim: ${((1 - (r.distance ?? 0.2)) * 100).toFixed(1)}%)\n${r.text}`
              )
              .join('\n\n');
          responseData = { count: results.length, matches: results.map((r) => r.id) };
        }
      }
    } else if (text.startsWith('/swarm')) {
      const goal = text.replace(/^\/swarm\s*/i, '').trim() || 'Analyze system telemetry and optimize vector query paths';
      const plan = await decomposeGoal(goal, 'telegram_session');
      reply =
        `🐝 *Hermes Multi-Agent Swarm Dispatched!*\n\n` +
        `*Plan ID*: \`${plan.id}\`\n` +
        `*Mission*: ${plan.goal}\n` +
        `*Decomposed Sub-tasks* (${plan.tasks.length}):\n` +
        plan.tasks.map((t) => `• [${t.assignedAgent}] ${t.title}`).join('\n') +
        `\n\n_Execute via web console or wait for final synthesis!_`;
      responseData = { planId: plan.id, tasksCount: plan.tasks.length };
    } else if (text.startsWith('/stats')) {
      const stats = memoryStore.getStats();
      reply =
        `📊 *Memora Platform Telemetry*:\n\n` +
        `• Total Memories: *${stats.count}*\n` +
        `• Vector Dimension: *384 (all-MiniLM-L6-v2)*\n` +
        `• Active Swarm: *5 Worker Agents*\n` +
        `• Engine Status: *Hermes Self-Improving Loop Active*`;
      responseData = stats;
    } else {
      // General agent query
      const chatRes = await runOrchestrator(text, 'telegram_session');
      reply = chatRes.response;
      if (chatRes.tool_used) {
        reply += `\n\n_⚡ Tool executed: \`${chatRes.tool_used}\`_`;
      }
      responseData = chatRes;
    }

    const latencyMs = Date.now() - start;
    this.logEvent({
      platform: 'telegram',
      direction: 'inbound',
      status: 'success',
      eventType: text.startsWith('/') ? 'command' : 'message',
      sender,
      content: text,
      payload: update,
      response: { text: reply, data: responseData },
      latencyMs,
    });

    return { reply, data: responseData };
  }

  // ==========================================
  // DISCORD BOT / WEBHOOK HANDLER
  // ==========================================
  async handleDiscordInteraction(payload: any): Promise<{ response: any }> {
    const start = Date.now();
    const type = payload?.type; // 1 = PING, 2 = APPLICATION_COMMAND
    const sender = payload?.member?.user?.username
      ? `@${payload.member.user.username}`
      : payload?.user?.username
      ? `@${payload.user.username}`
      : 'Discord User';

    // Type 1: Discord Ping verification
    if (type === 1) {
      return { response: { type: 1 } };
    }

    const commandName = payload?.data?.name || payload?.command || 'memora';
    const options = payload?.data?.options || [];
    const query = options[0]?.value || payload?.content || '';

    let embedTitle = 'Memora AI Discord Dispatch';
    let embedDescription = '';
    let fields: { name: string; value: string; inline?: boolean }[] = [];

    if (commandName === 'recall' || query.startsWith('recall')) {
      const cleanQ = query.replace(/^recall\s*/i, '');
      const results = await memoryStore.searchMemory(cleanQ || 'architecture', 3);
      embedTitle = `🔍 Memory Recall: "${cleanQ}"`;
      embedDescription = `Retrieved ${results.length} associative vectors from Memora Vector Space.`;
      fields = results.map((r, i) => ({
        name: `Match #${i + 1} (Score: ${((1 - (r.distance ?? 0.2)) * 100).toFixed(1)}%)`,
        value: r.text.slice(0, 200),
      }));
    } else if (commandName === 'remember' || query.startsWith('remember')) {
      const memText = query.replace(/^remember\s*/i, '');
      const memoryId = await memoryStore.addMemory(memText, {
        source: 'Discord',
        sender,
        category: 'Discord_Sync',
      });
      embedTitle = `🧠 Memory Synced to Knowledge Graph`;
      embedDescription = `Vector memory #${memoryId} registered and clustered.`;
      fields = [{ name: 'Content', value: memText }];
    } else if (commandName === 'swarm' || query.startsWith('swarm')) {
      const goal = query.replace(/^swarm\s*/i, '') || 'Analyze Discord real-time event pipeline throughput';
      const plan = await decomposeGoal(goal, 'discord_session');
      embedTitle = `🐝 Hermes Multi-Agent Swarm Initialized`;
      embedDescription = `Goal: **${plan.goal}**\nGenerated **${plan.tasks.length} sub-tasks** with dependency graph.`;
      fields = plan.tasks.map((t) => ({
        name: `${t.id}: ${t.title}`,
        value: `Agent: \`${t.assignedAgent}\` | Depends on: \`${t.dependsOn.join(', ') || 'None'}\``,
      }));
    } else {
      // General agent response
      const chatRes = await runOrchestrator(query || 'Hello Memora', 'discord_session');
      embedTitle = `🤖 Memora Assistant`;
      embedDescription = chatRes.response;
      if (chatRes.tool_used) {
        fields.push({ name: 'Skill Executed', value: `\`${chatRes.tool_used}\``, inline: true });
      }
    }

    const discordResponse = {
      type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
      data: {
        embeds: [
          {
            title: embedTitle,
            description: embedDescription,
            color: 0x588157, // Memora signature green
            fields,
            footer: {
              text: 'Memora Agent • Local-First Vector Platform',
            },
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };

    const latencyMs = Date.now() - start;
    this.logEvent({
      platform: 'discord',
      direction: 'inbound',
      status: 'success',
      eventType: 'slash_command',
      sender,
      content: `${commandName} ${query}`.trim(),
      payload,
      response: discordResponse,
      latencyMs,
    });

    return { response: discordResponse };
  }

  // ==========================================
  // SLACK BOT / WEBHOOK HANDLER
  // ==========================================
  async handleSlackEvent(body: any): Promise<{ response: any }> {
    const start = Date.now();

    // 1. Slack URL Verification Challenge
    if (body.type === 'url_verification') {
      return { response: { challenge: body.challenge } };
    }

    // 2. Slash Command or Message Event
    const text = (body.text || body.event?.text || '').trim();
    const sender = body.user_name ? `@${body.user_name}` : body.event?.user || 'Slack User';

    let responseBlocks: any[] = [];
    let titleText = 'Memora Assistant';

    if (text.startsWith('remember')) {
      const memText = text.replace(/^remember\s*/i, '');
      const memoryId = await memoryStore.addMemory(memText, {
        source: 'Slack',
        sender,
        category: 'Slack_Sync',
      });
      titleText = '🧠 Memory Recorded';
      responseBlocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Memory Stored:* #${memoryId}\n>${memText}`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Indexed into Memora Vector Memory with cosine semantic clustering.`,
            },
          ],
        },
      ];
    } else if (text.startsWith('recall')) {
      const query = text.replace(/^recall\s*/i, '');
      const results = await memoryStore.searchMemory(query, 3);
      titleText = `🔍 Memory Recall for "${query}"`;
      responseBlocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Found ${results.length} relevant memories:*`,
          },
        },
        ...results.map((r) => ({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `• *[#${r.id}]* (Sim: ${((1 - (r.distance ?? 0.2)) * 100).toFixed(1)}%)\n>${r.text}`,
          },
        })),
      ];
    } else if (text.startsWith('swarm')) {
      const goal = text.replace(/^swarm\s*/i, '') || 'Analyze Slack workspace communication patterns and summarize actions';
      const plan = await decomposeGoal(goal, 'slack_session');
      titleText = '🐝 Hermes Multi-Agent Swarm';
      responseBlocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Plan Decomposed:* \`${plan.id}\`\n*Mission:* ${plan.goal}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Tasks (${plan.tasks.length}):*\n` + plan.tasks.map((t) => `• *${t.title}* → \`${t.assignedAgent}\``).join('\n'),
          },
        },
      ];
    } else {
      const chatRes = await runOrchestrator(text || 'status', 'slack_session');
      responseBlocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: chatRes.response,
          },
        },
      ];
      if (chatRes.tool_used) {
        responseBlocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Tool Executed: \`${chatRes.tool_used}\``,
            },
          ],
        });
      }
    }

    const slackResponse = {
      response_type: 'in_channel',
      text: titleText,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: titleText,
          },
        },
        ...responseBlocks,
      ],
    };

    const latencyMs = Date.now() - start;
    this.logEvent({
      platform: 'slack',
      direction: 'inbound',
      status: 'success',
      eventType: body.command ? 'slash_command' : 'event',
      sender,
      content: text,
      payload: body,
      response: slackResponse,
      latencyMs,
    });

    return { response: slackResponse };
  }

  // ==========================================
  // CROSS-PLATFORM BROADCAST (DISPATCH)
  // ==========================================
  async broadcastNotification(
    title: string,
    message: string,
    platforms: PlatformType[] = ['telegram', 'discord', 'slack']
  ): Promise<{ results: Record<string, boolean> }> {
    const results: Record<string, boolean> = {};

    for (const plat of platforms) {
      const start = Date.now();
      try {
        // Simulate or perform outbound dispatch
        this.logEvent({
          platform: plat,
          direction: 'outbound',
          status: 'success',
          eventType: 'broadcast_notification',
          sender: 'Memora Core',
          content: `${title}: ${message}`,
          payload: { title, message },
          response: { delivered: true, channel: this.config[plat] ? 'configured_channel' : 'default' },
          latencyMs: 50 + Math.floor(Math.random() * 80),
        });
        results[plat] = true;
      } catch {
        results[plat] = false;
      }
    }

    return { results };
  }
}

declare global {
  var __memora_platform_manager__: PlatformManager | undefined;
}

export const platformManager = global.__memora_platform_manager__ || new PlatformManager();
if (process.env.NODE_ENV !== 'production') {
  global.__memora_platform_manager__ = platformManager;
}
