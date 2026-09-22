import { NextResponse } from 'next/server';
import { builtInSkills } from '@/lib/memora/skills';

export async function GET() {
  const skillSamplePrompts: Record<string, string[]> = {
    calculator: ['calculate (120 * 4) + sqrt(256)', 'what is 2 ^ 10?'],
    time: ['what time is it right now?', 'current system time'],
    unit_converter: ['convert 100 celsius to fahrenheit', 'convert 75 kg to pounds', 'convert 50 km to miles'],
    text_formatter: ['format uppercase: autonomous agents', 'format slugify: Distributed AI Systems'],
    save_note: ['remember: user preferred deployment region is ap-south-1', 'save note: project deadline is Nov 15'],
    web_search: ['search for: local open source LLMs 2026', 'search for: vector database benchmarks'],
    json_parser: ['validate json: {"status": "ok", "retries": 3}'],
    code_interpreter: ['run code: [10, 20, 30, 40].reduce((a, b) => a + b, 0)', 'run code: Math.hypot(3, 4)'],
    forget_memory: ['forget: project deadline', 'delete memory: deployment region'],
    summarizer: ['summarize: Sovereign AI agents combine continuous memory, sandboxed skill execution, and local-first vector retrieval to enable zero-telemetry operations.'],
    language_translator: ['translate to hindi: Artificial intelligence is transforming humanity', 'translate to english: Namaste dosto, kya haal hai?'],
    sentiment_analyzer: ['sentiment of: The system performed flawlessly with exceptionally low latency!', 'analyze tone: I am disappointed with this repeated delay.'],
    weather_sim: ['weather in Mumbai', 'weather in Bengaluru', 'weather in London'],
    swarm_planner: ['swarm plan: Build a microservices event pipeline', 'plan task: Launch an autonomous marketing campaign'],
  };

  const skills = Object.entries(builtInSkills).map(([id, skill]) => ({
    id,
    name: skill.name,
    description: skill.description,
    inputSchema: skill.inputSchema || null,
    samplePrompts: skillSamplePrompts[id] || [],
  }));

  return NextResponse.json({
    count: skills.length,
    skills,
  });
}
