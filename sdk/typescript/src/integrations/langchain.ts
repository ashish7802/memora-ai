import { MemoraClient } from '../index';

export interface LangChainMemoryInput {
  sessionId?: string;
  userId?: string;
  memoryKey?: string;
  inputKey?: string;
  outputKey?: string;
  topK?: number;
  cluster?: string;
  baseUrl?: string;
  apiKey?: string;
  client?: MemoraClient;
}

/**
 * Memora memory adapter for LangChain.js
 */
export class MemoraLangChainMemory {
  public memoryKey: string;
  public sessionId: string;
  public userId?: string;
  public inputKey: string;
  public outputKey: string;
  public topK: number;
  public cluster: string;
  private client: MemoraClient;

  constructor(fields: LangChainMemoryInput = {}) {
    this.memoryKey = fields.memoryKey || 'history';
    this.sessionId = fields.sessionId || 'default';
    this.userId = fields.userId;
    this.inputKey = fields.inputKey || 'input';
    this.outputKey = fields.outputKey || 'output';
    this.topK = fields.topK || 5;
    this.cluster = fields.cluster || 'conversation';
    this.client = fields.client || new MemoraClient({ baseUrl: fields.baseUrl, apiKey: fields.apiKey });
  }

  get memoryVariables(): string[] {
    return [this.memoryKey];
  }

  async loadMemoryVariables(values: Record<string, any>): Promise<Record<string, any>> {
    let queryText = '';
    if (this.inputKey && values[this.inputKey]) {
      queryText = String(values[this.inputKey]);
    } else if (Object.keys(values).length > 0) {
      queryText = Object.values(values).map(String).join(' ');
    }

    if (!queryText.trim()) {
      return { [this.memoryKey]: '' };
    }

    const memories = await this.client.recall({
      query: queryText,
      session_id: this.sessionId,
      user_id: this.userId,
      cluster: this.cluster,
      top_k: this.topK,
    });

    const context = memories.map((m) => `- ${m.text}`).join('\n');
    return { [this.memoryKey]: context };
  }

  async saveContext(inputValues: Record<string, any>, outputValues: Record<string, any>): Promise<void> {
    const inputStr = inputValues[this.inputKey] || '';
    const outputStr = outputValues[this.outputKey] || '';

    const text = `Human: ${inputStr}\nAI: ${outputStr}`;
    await this.client.remember({
      text,
      session_id: this.sessionId,
      user_id: this.userId,
      cluster: this.cluster,
      importance: 1.0,
      metadata: { source: 'langchain_dialogue', type: 'context_save' },
    });
  }

  async clear(): Promise<void> {
    await this.client.prune({ session_id: this.sessionId });
  }
}
