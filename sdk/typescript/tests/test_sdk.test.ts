import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { MemoraClient, MemoryManager, MemoraAuthError, MemoraRateLimitError } from '../src/index';

vi.mock('axios');

describe('TypeScript SDK Test Suite', () => {
  const mockedAxios = axios as unknown as {
    create: any;
    isAxiosError: any;
  };

  const mockPost = vi.fn();
  const mockDelete = vi.fn();
  const mockPut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockedAxios.create = vi.fn(() => ({
      post: mockPost,
      delete: mockDelete,
      put: mockPut,
    }));
    mockedAxios.isAxiosError = vi.fn((err: any) => Boolean(err?.isAxiosError));
  });

  it('should remember and recall memory correctly', async () => {
    mockPost.mockImplementation((url: string) => {
      if (url === '/v1/memory/add') {
        return Promise.resolve({
          data: {
            id: '11111111-1111-1111-1111-111111111111',
            text: 'User prefers TypeScript strict mode',
            session_id: 'sess_1',
            cluster: 'preferences',
            importance: 1.0,
            access_count: 0,
            metadata: {},
            created_at: '2026-09-02T12:00:00Z',
            updated_at: '2026-09-02T12:00:00Z',
            last_accessed_at: '2026-09-02T12:00:00Z',
          },
        });
      }
      if (url === '/v1/memory/search') {
        return Promise.resolve({
          data: {
            status: 'success',
            count: 1,
            data: [
              {
                id: '11111111-1111-1111-1111-111111111111',
                text: 'User prefers TypeScript strict mode',
                similarity_score: 0.95,
              },
            ],
          },
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    const client = new MemoraClient({ apiKey: 'mm_test_secret' });
    const memory = await client.remember('User prefers TypeScript strict mode', 'sess_1');
    expect(memory.id).toBe('11111111-1111-1111-1111-111111111111');

    const searchResults = await client.recall('TypeScript preferences', 5, 'sess_1');
    expect(searchResults.length).toBe(1);
    expect(searchResults[0].similarity_score).toBe(0.95);
  });

  it('should handle auth error correctly with custom exception', async () => {
    mockPost.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 401,
        data: {
          error: {
            code: 'API_KEY_REQUIRED',
            message: 'API Key missing',
          },
        },
      },
    });

    const client = new MemoraClient();
    await expect(client.remember('Test note')).rejects.toThrowError(MemoraAuthError);
  });

  it('should support session-scoped MemoryManager', async () => {
    mockPost.mockResolvedValue({
      data: {
        id: '22222222-2222-2222-2222-222222222222',
        text: 'Session scoped note',
        session_id: 'chat_session_99',
      },
    });

    const manager = new MemoryManager({ sessionId: 'chat_session_99' });
    const note = await manager.remember('Session scoped note');
    expect(note.session_id).toBe('chat_session_99');
  });
});
