import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../../config/constants';
import { createOpenRouterStream } from './streaming';

const streamFromText = (text: string): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
};

describe('createOpenRouterStream', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    const localStorageMock = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    };

    vi.stubGlobal('localStorage', localStorageMock);
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: localStorageMock,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('closes an open reasoning block when the stream ends without a DONE marker', async () => {
    localStorage.setItem(STORAGE_KEYS.OPENROUTER_API_KEY, 'sk-or-v1-local');
    const chunks: string[] = [];
    const onComplete = vi.fn();
    const onError = vi.fn();

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            streamFromText('data: {"choices":[{"delta":{"reasoning":"plan parcial"}}]}\n'),
            { status: 200 }
          )
        )
    );

    await createOpenRouterStream(
      {
        model: 'reasoning-model',
        messages: [{ role: 'user', content: 'Hola' }],
        reasoning: { enabled: true },
      },
      {
        onChunk: (chunk) => chunks.push(chunk),
        onComplete,
        onError,
      }
    );

    expect(chunks).toEqual(['<thinking>', 'plan parcial', '</thinking>']);
    expect(onComplete).toHaveBeenCalledWith('');
    expect(onError).not.toHaveBeenCalled();
  });
  const mockSse = (lines: string[]) =>
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(streamFromText(lines.map((line) => `data: ${line}\n`).join('')), {
          status: 200,
        })
      )
    );

  it('reports finish reason and token usage (including cache hits) before completing', async () => {
    localStorage.setItem(STORAGE_KEYS.OPENROUTER_API_KEY, 'sk-or-v1-local');
    mockSse([
      '{"choices":[{"delta":{"content":"Hola"}}]}',
      '{"choices":[{"delta":{"content":""},"finish_reason":"length"}]}',
      JSON.stringify({
        choices: [],
        usage: {
          prompt_tokens: 2000,
          completion_tokens: 50,
          prompt_tokens_details: { cached_tokens: 1800, cache_write_tokens: 120 },
          completion_tokens_details: { reasoning_tokens: 30 },
          cost: 0.0012,
        },
      }),
      '[DONE]',
    ]);
    const events: string[] = [];
    const onMetadata = vi.fn(() => events.push('metadata'));
    const onComplete = vi.fn(() => events.push('complete'));

    await createOpenRouterStream(
      { model: 'anthropic/claude-sonnet-4.5', messages: [{ role: 'user', content: 'Hola' }] },
      { onChunk: vi.fn(), onComplete, onError: vi.fn(), onMetadata }
    );

    expect(onMetadata).toHaveBeenCalledWith({
      finishReason: 'length',
      usage: {
        promptTokens: 2000,
        completionTokens: 50,
        cachedTokens: 1800,
        cacheWriteTokens: 120,
        reasoningTokens: 30,
        cost: 0.0012,
      },
    });
    expect(events).toEqual(['metadata', 'complete']);
    expect(onComplete).toHaveBeenCalledWith('Hola');
  });

  it('surfaces errors sent inside the stream', async () => {
    localStorage.setItem(STORAGE_KEYS.OPENROUTER_API_KEY, 'sk-or-v1-local');
    mockSse([
      '{"choices":[{"delta":{"content":"Ho"}}]}',
      '{"error":{"message":"Provider disconnected","code":502},"choices":[{"finish_reason":"error"}]}',
    ]);
    const onComplete = vi.fn();
    const onError = vi.fn();

    await createOpenRouterStream(
      { model: 'openai/gpt-5', messages: [{ role: 'user', content: 'Hola' }] },
      { onChunk: vi.fn(), onComplete, onError }
    );

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Provider disconnected' })
    );
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('shows reasoning for effort and token-budget configurations, not only `enabled`', async () => {
    localStorage.setItem(STORAGE_KEYS.OPENROUTER_API_KEY, 'sk-or-v1-local');
    for (const reasoning of [{ effort: 'high' as const }, { max_tokens: 4096 }]) {
      mockSse(['{"choices":[{"delta":{"reasoning":"pienso"}}]}', '[DONE]']);
      const chunks: string[] = [];

      await createOpenRouterStream(
        { model: 'any', messages: [{ role: 'user', content: 'Hola' }], reasoning },
        { onChunk: (chunk) => chunks.push(chunk), onComplete: vi.fn(), onError: vi.fn() }
      );

      expect(chunks).toEqual(['<thinking>', 'pienso', '</thinking>']);
    }
  });

  it('hides reasoning when it is explicitly excluded', async () => {
    localStorage.setItem(STORAGE_KEYS.OPENROUTER_API_KEY, 'sk-or-v1-local');
    mockSse(['{"choices":[{"delta":{"reasoning":"pienso"}}]}', '[DONE]']);
    const chunks: string[] = [];

    await createOpenRouterStream(
      {
        model: 'any',
        messages: [{ role: 'user', content: 'Hola' }],
        reasoning: { effort: 'low', exclude: true },
      },
      { onChunk: (chunk) => chunks.push(chunk), onComplete: vi.fn(), onError: vi.fn() }
    );

    expect(chunks).toEqual([]);
  });

  it('sends prompt caching parameters in the request body', async () => {
    localStorage.setItem(STORAGE_KEYS.OPENROUTER_API_KEY, 'sk-or-v1-local');
    mockSse(['[DONE]']);

    await createOpenRouterStream(
      {
        model: 'anthropic/claude-sonnet-4.5',
        messages: [{ role: 'user', content: 'Hola' }],
        cache_control: { type: 'ephemeral' },
        session_id: 'chat-1',
      },
      { onChunk: vi.fn(), onComplete: vi.fn(), onError: vi.fn() }
    );

    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(body).toMatchObject({
      stream: true,
      cache_control: { type: 'ephemeral' },
      session_id: 'chat-1',
    });
  });
});
