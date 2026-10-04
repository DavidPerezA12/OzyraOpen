import { describe, expect, it, vi } from 'vitest';
import { parseChatCompletionResponse } from './responseValidation';
import { fetchOpenRouterModels, resolveOpenRouterBaseUrl } from './client';

const validResponse = {
  id: 'gen-1',
  object: 'chat.completion',
  created: 1_700_000_000,
  model: 'openai/gpt-4',
  choices: [
    {
      index: 0,
      message: { role: 'assistant', content: 'Hola' },
      finish_reason: 'stop',
    },
  ],
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
};

describe('parseChatCompletionResponse', () => {
  it('acepta una respuesta válida', () => {
    const parsed = parseChatCompletionResponse(validResponse);
    expect(parsed.choices).toHaveLength(1);
    expect(parsed.choices[0]?.message.content).toBe('Hola');
  });

  it('acepta choices vacío y content nulo (tool calls)', () => {
    expect(parseChatCompletionResponse({ choices: [] }).choices).toEqual([]);
    expect(
      parseChatCompletionResponse({ choices: [{ message: { content: null } }] }).choices
    ).toHaveLength(1);
  });

  it('rechaza payloads malformados', () => {
    expect(() => parseChatCompletionResponse(null)).toThrow();
    expect(() => parseChatCompletionResponse([])).toThrow();
    expect(() => parseChatCompletionResponse({})).toThrow();
    expect(() => parseChatCompletionResponse({ choices: [{ message: null }] })).toThrow();
    expect(() =>
      parseChatCompletionResponse({ choices: [{ message: { content: 42 } }] })
    ).toThrow();
  });

  it('propaga el error del proveedor', () => {
    expect(() => parseChatCompletionResponse({ error: 'boom' })).toThrow('boom');
    expect(() => parseChatCompletionResponse({ error: { message: 'bad' } })).toThrow();
  });
});

describe('resolveOpenRouterBaseUrl', () => {
  it('resuelve el endpoint oficial por defecto', () => {
    expect(resolveOpenRouterBaseUrl()).toBe('https://openrouter.ai/api/v1');
  });

  it('rechaza hosts arbitrarios aunque vengan de env', () => {
    vi.stubEnv('VITE_OPENROUTER_BASE_URL', 'https://evil.exfil/api');
    expect(() => resolveOpenRouterBaseUrl()).toThrow();
    vi.unstubAllEnvs();
  });
});

describe('fetchOpenRouterModels', () => {
  it('filtra entradas sin id string', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [{ id: 'openai/gpt-4' }, { id: 42 }, { name: 'sin id' }, null],
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const models = await fetchOpenRouterModels();
      expect(models).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rechaza formato inválido', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'no-array' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      await expect(fetchOpenRouterModels()).rejects.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
