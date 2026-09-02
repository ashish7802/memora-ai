import { NextRequest, NextResponse } from 'next/server';
import { ollamaManager } from '@/lib/memora/ollama';

export async function GET() {
  try {
    const health = await ollamaManager.checkHealth();
    const config = ollamaManager.getConfig();
    return NextResponse.json({
      status: 'success',
      health,
      config,
    });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'update_config') {
      const updated = ollamaManager.updateConfig(body.config || {});
      const health = await ollamaManager.checkHealth();
      return NextResponse.json({ status: 'success', config: updated, health });
    }

    if (action === 'generate') {
      const { prompt, systemPrompt, model } = body;
      if (!prompt) {
        return NextResponse.json({ status: 'error', error: 'Prompt is required' }, { status: 400 });
      }
      const result = await ollamaManager.generate(prompt, systemPrompt, model);
      return NextResponse.json({ status: 'success', result });
    }

    if (action === 'embed') {
      const { text, model } = body;
      if (!text) {
        return NextResponse.json({ status: 'error', error: 'Text is required' }, { status: 400 });
      }
      const embedding = await ollamaManager.getEmbedding(text, model);
      return NextResponse.json({
        status: 'success',
        dimensions: embedding.length,
        embeddingPreview: embedding.slice(0, 8),
      });
    }

    return NextResponse.json({ status: 'error', error: 'Invalid action specified' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
  }
}
