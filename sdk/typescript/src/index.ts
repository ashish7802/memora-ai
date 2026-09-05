import axios, { AxiosError, AxiosInstance } from 'axios';

export interface RankingBreakdown {
  vector_similarity: number;
  recency_score: number;
  importance_score: number;
  frequency_score: number;
  combined_score: number;
}

export interface Memory {
  id: string;
  tenant_id?: string;
  text: string;
  session_id: string;
  user_id?: string;
  agent_id?: string;
  cluster: string;
  memory_type: string;
  status: string;
  importance: number;
  confidence: number;
  access_count: number;
  recall_count: number;
  source_type: string;
  source_id?: string;
  document_id?: string;
  message_id?: string;
  metadata: Record<string, any>;
  similarity_score?: number;
  cosine_distance?: number;
  ranking_breakdown?: RankingBreakdown;
  conflict_warning?: string;
  valid_from?: string;
  valid_until?: string;
  last_recalled_at?: string;
  forgotten_at?: string;
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
  embedding_provider?: string;
  embedding_model?: string;
}

export interface MemoryCreateInput {
  text: string;
  session_id?: string;
  user_id?: string;
  agent_id?: string;
  cluster?: string;
  memory_type?: string;
  importance?: number;
  confidence?: number;
  metadata?: Record<string, any>;
  valid_from?: string;
  valid_until?: string;
  legal_basis?: string;
  retention_policy?: string;
}

export interface MemorySearchInput {
  query: string;
  session_id?: string;
  cluster?: string;
  user_id?: string;
  memory_type?: string;
  status?: string;
  top_k?: number;
  threshold?: number;
  as_of?: string;
  include_explanation?: boolean;
}

export interface MemoryUpdateInput {
  id: string;
  text?: string;
  cluster?: string;
  memory_type?: string;
  status?: string;
  importance?: number;
  confidence?: number;
  metadata?: Record<string, any>;
  valid_until?: string;
}

export interface MemoryForgetResult {
  status: string;
  memory_id: string;
  mode: string;
  audit_log_id: string;
  deletion_proof?: string;
  message: string;
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

export interface AuditLogEntry {
  id: string;
  tenant_id: string;
  target_type: string;
  target_id: string;
  action: string;
  actor_type: string;
  actor_id?: string;
  reason?: string;
  metadata: Record<string, any>;
  timestamp: string;
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
      'User-Agent': 'memora-ts-sdk/0.2.0',
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

  async remember(input: MemoryCreateInput | string, sessionId = 'default', options?: Partial<MemoryCreateInput>): Promise<Memory> {
    try {
      const payload: MemoryCreateInput = typeof input === 'string'
        ? { text: input, session_id: sessionId, ...options }
        : { session_id: 'default', cluster: 'general', importance: 1.0, metadata: {}, ...input };

      const res = await this.http.post<Memory>('/v1/memory', payload);
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

  async forget(id: string, mode: 'soft' | 'hard' = 'soft', reason = 'user_command'): Promise<MemoryForgetResult> {
    try {
      const res = await this.http.post<MemoryForgetResult>(`/v1/memory/${id}/forget`, {
        mode,
        reason,
      });
      return res.data;
    } catch (err) {
      this.handleError(err);
    }
  }

  async delete(id: string): Promise<MemoryDeleteResult> {
    try {
      const res = await this.http.delete<MemoryDeleteResult>(`/v1/memory/${id}`);
      return res.data;
    } catch (err) {
      this.handleError(err);
    }
  }

  async update(input: MemoryUpdateInput): Promise<Memory> {
    try {
      const res = await this.http.put<Memory>(`/v1/memory/${input.id}`, input);
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

  async getAuditLogs(targetId?: string, limit = 50): Promise<AuditLogEntry[]> {
    try {
      const params: Record<string, any> = { limit };
      if (targetId) params.target_id = targetId;
      const res = await this.http.get<{ status: string; data: AuditLogEntry[] }>('/v1/memory/audit', { params });
      return res.data.data;
    } catch (err) {
      this.handleError(err);
    }
  }

  async getStats(): Promise<Record<string, any>> {
    try {
      const res = await this.http.get<Record<string, any>>('/v1/stats');
      return res.data;
    } catch (err) {
      this.handleError(err);
    }
  }

  // Aliases for compatibility
  add = this.remember;
  search = this.recall;
}

export default MemoraClient;
