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
});
