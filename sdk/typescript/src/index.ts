import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export interface Memory {
  id: string;
  text: string;
  session_id: string;
  user_id?: string;
  agent_id?: string;
  cluster: string;
  importance: number;
  access_count: number;
  metadata: Record<string, any>;
  similarity_score?: number;
  cosine_distance?: number;
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
}

export interface MemoryCreateInput {
  text: string;
  session_id?: string;
  user_id?: string;
  agent_id?: string;
  cluster?: string;
  importance?: number;
  metadata?: Record<string, any>;
}

export interface MemorySearchInput {
  query: string;
  session_id?: string;
  cluster?: string;
  user_id?: string;
  top_k?: number;
  threshold?: number;
}

export interface MemoryUpdateInput {
  id: string;
  text?: string;
  cluster?: string;
  importance?: number;
  metadata?: Record<string, any>;
}

export interface MemoryDeleteResult {
  status: string;
  deleted_id: string;
  message: string;
}

export interface MemoryPruneInput {
  session_id?: string;
  older_than_days?: number;
  max_importance?: number;
  max_access_count?: number;
}

export interface MemoryPruneResult {
  status: string;
  pruned_count: number;
  message: string;
}

export interface MemoraClientOptions {
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export class MemoraClient {
  private http: AxiosInstance;

  constructor(options: MemoraClientOptions = {}) {
    const baseURL = (options.baseUrl || 'http://localhost:8000').replace(/\/+$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'memora-ts-sdk/0.1.0',
      ...(options.headers || {}),
    };

    if (options.apiKey) {
      headers['Authorization'] = `Bearer ${options.apiKey}`;
      headers['X-API-Key'] = options.apiKey;
    }

    this.http = axios.create({
      baseURL,
      headers,
      timeout: options.timeout || 30000,
    });
  }

  async add(input: MemoryCreateInput): Promise<Memory> {
    const res = await this.http.post<Memory>('/v1/memory/add', {
      session_id: 'default',
      cluster: 'general',
      importance: 1.0,
      metadata: {},
      ...input,
    });
    return res.data;
  }

  async search(input: MemorySearchInput): Promise<Memory[]> {
    const res = await this.http.post<{ status: string; count: number; data: Memory[] }>('/v1/memory/search', {
      top_k: 5,
      ...input,
    });
    return res.data.data;
  }

  async update(input: MemoryUpdateInput): Promise<Memory> {
    const res = await this.http.put<Memory>('/v1/memory/update', input);
    return res.data;
  }

  async delete(id: string): Promise<MemoryDeleteResult> {
    const res = await this.http.delete<MemoryDeleteResult>('/v1/memory/delete', {
      data: { id },
    });
    return res.data;
  }

  async prune(input: MemoryPruneInput = {}): Promise<MemoryPruneResult> {
    const res = await this.http.post<MemoryPruneResult>('/v1/memory/prune', input);
    return res.data;
  }
}

/**
 * High-level session-scoped Memory Manager for TypeScript
 */
export class MemoryManager {
  private client: MemoraClient;
  public sessionId: string;
  public userId?: string;
  public agentId?: string;

  constructor(options: {
    sessionId?: string;
    userId?: string;
    agentId?: string;
    client?: MemoraClient;
    baseUrl?: string;
    apiKey?: string;
  } = {}) {
    this.sessionId = options.sessionId || 'default';
    this.userId = options.userId;
    this.agentId = options.agentId;
    this.client = options.client || new MemoraClient({ baseUrl: options.baseUrl, apiKey: options.apiKey });
  }

  async remember(text: string, cluster = 'general', importance = 1.0, metadata?: Record<string, any>): Promise<Memory> {
    return this.client.add({
      text,
      session_id: this.sessionId,
      user_id: this.userId,
      agent_id: this.agentId,
      cluster,
      importance,
      metadata,
    });
  }

  async recall(query: string, cluster?: string, top_k = 5, threshold?: number): Promise<Memory[]> {
    return this.client.search({
      query,
      session_id: this.sessionId,
      user_id: this.userId,
      cluster,
      top_k,
      threshold,
    });
  }

  async forget(id: string): Promise<MemoryDeleteResult> {
    return this.client.delete(id);
  }

  async edit(id: string, updates: Omit<MemoryUpdateInput, 'id'>): Promise<Memory> {
    return this.client.update({ id, ...updates });
  }

  async clean(olderThanDays?: number, maxImportance = 1.0, maxAccessCount = 0.0): Promise<MemoryPruneResult> {
    return this.client.prune({
      session_id: this.sessionId,
      older_than_days: olderThanDays,
      max_importance: maxImportance,
      max_access_count: maxAccessCount,
    });
  }
}
