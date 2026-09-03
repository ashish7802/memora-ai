import axios, { AxiosError, AxiosInstance } from 'axios';

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

export class MemoraError extends Error {
  public statusCode?: number;
  public code?: string;
  public responseBody?: any;

  constructor(message: string, statusCode?: number, code?: string, responseBody?: any) {
    super(message);
    this.name = 'MemoraError';
    this.statusCode = statusCode;
    this.code = code;
    this.responseBody = responseBody;
  }
}

export class MemoraAPIError extends MemoraError {
  constructor(message: string, statusCode?: number, code?: string, responseBody?: any) {
    super(message, statusCode, code, responseBody);
    this.name = 'MemoraAPIError';
  }
}

export class MemoraAuthError extends MemoraAPIError {
  constructor(message: string, statusCode?: number, code?: string, responseBody?: any) {
    super(message, statusCode, code || 'API_KEY_REQUIRED', responseBody);
    this.name = 'MemoraAuthError';
  }
}

export class MemoraRateLimitError extends MemoraAPIError {
  public retryAfter?: number;

  constructor(message: string, retryAfter?: number, responseBody?: any) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', responseBody);
    this.name = 'MemoraRateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class MemoraNotFoundError extends MemoraAPIError {
  constructor(message: string, statusCode?: number, code?: string, responseBody?: any) {
    super(message, statusCode || 404, code || 'NOT_FOUND', responseBody);
    this.name = 'MemoraNotFoundError';
  }
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

  private handleError(err: any): never {
    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosError<any>;
      const status = axiosErr.response?.status;
      const data = axiosErr.response?.data;

      let code = data?.error?.code;
      let message = data?.error?.message || axiosErr.message;

      if (status === 401 || status === 403) {
        throw new MemoraAuthError(message, status, code, data);
      }
      if (status === 404) {
        throw new MemoraNotFoundError(message, status, code, data);
      }
      if (status === 429) {
        const retryHeader = axiosErr.response?.headers?.['retry-after'];
        const retryAfter = retryHeader ? parseInt(retryHeader, 10) : undefined;
        throw new MemoraRateLimitError(message, retryAfter, data);
      }
      throw new MemoraAPIError(message, status, code, data);
    }
    throw new MemoraError(err?.message || 'Unknown network error', undefined, undefined, err);
  }

  // Core Wedge API
  async remember(input: MemoryCreateInput | string, sessionId = 'default', options?: Partial<MemoryCreateInput>): Promise<Memory> {
    try {
      const payload: MemoryCreateInput = typeof input === 'string'
        ? { text: input, session_id: sessionId, ...options }
        : { session_id: 'default', cluster: 'general', importance: 1.0, metadata: {}, ...input };

      const res = await this.http.post<Memory>('/v1/memory/add', payload);
      return res.data;
    } catch (err) {
      this.handleError(err);
    }
  }

  async recall(queryOrInput: string | MemorySearchInput, topK = 5, sessionId?: string): Promise<Memory[]> {
    try {
      const payload: MemorySearchInput = typeof queryOrInput === 'string'
        ? { query: queryOrInput, top_k: topK, session_id: sessionId }
        : { top_k: 5, ...queryOrInput };

      const res = await this.http.post<{ status: string; count: number; data: Memory[] }>('/v1/memory/search', payload);
      return res.data.data;
    } catch (err) {
      this.handleError(err);
    }
  }

  async forget(id: string): Promise<MemoryDeleteResult> {
    try {
      const res = await this.http.delete<MemoryDeleteResult>('/v1/memory/delete', {
        data: { id },
      });
      return res.data;
    } catch (err) {
      this.handleError(err);
    }
  }

  async update(input: MemoryUpdateInput): Promise<Memory> {
    try {
      const res = await this.http.put<Memory>('/v1/memory/update', input);
      return res.data;
    } catch (err) {
      this.handleError(err);
    }
  }

  async prune(input: MemoryPruneInput = {}): Promise<MemoryPruneResult> {
    try {
      const res = await this.http.post<MemoryPruneResult>('/v1/memory/prune', input);
      return res.data;
    } catch (err) {
      this.handleError(err);
    }
  }

  // Aliases for compatibility
  add = this.remember;
  search = this.recall;
  delete = this.forget;
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
    return this.client.remember({
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
    return this.client.recall({
      query,
      session_id: this.sessionId,
      user_id: this.userId,
      cluster,
      top_k,
      threshold,
    });
  }

  async forget(id: string): Promise<MemoryDeleteResult> {
    return this.client.forget(id);
  }

  async update(id: string, updates: Omit<MemoryUpdateInput, 'id'>): Promise<Memory> {
    return this.client.update({ id, ...updates });
  }

  async prune(olderThanDays?: number, maxImportance = 1.0, maxAccessCount = 0.0): Promise<MemoryPruneResult> {
    return this.client.prune({
      session_id: this.sessionId,
      older_than_days: olderThanDays,
      max_importance: maxImportance,
      max_access_count: maxAccessCount,
    });
  }

  // Aliases
  add = this.remember;
  search = this.recall;
  delete = this.forget;
  edit = this.update;
  clean = this.prune;
}

export default MemoraClient;
