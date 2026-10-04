import { beforeEach, describe, expect, it, vi } from 'vitest';

import { chatService } from './chatService';
import { buildOpenRouterPayload } from './openrouter/buildPayload';
import {
  buildOpenRouterHeaders,
  createOpenRouterHttpError,
  fetchWithRetry,
  getOpenRouterConfig,
  normalizeOpenRouterError,
  readOpenRouterError,
} from './openrouter/client';
import { createOpenRouterStream } from './openrouter/streaming';
import type { ChatCompletionRequest, ChatCompletionResponse } from './openrouter/types';

vi.mock('./openrouter/buildPayload', () => ({
  buildOpenRouterPayload: vi.fn(),
}));

vi.mock('./openrouter/client', () => ({
  buildOpenRouterHeaders: vi.fn(),
  createOpenRouterHttpError: vi.fn(),
  fetchWithRetry: vi.fn(),
  getOpenRouterConfig: vi.fn(),
  normalizeOpenRouterError: vi.fn(),
  readOpenRouterError: vi.fn(),
}));

vi.mock('./openrouter/streaming', () => ({
  createOpenRouterStream: vi.fn(),
}));

const request: ChatCompletionRequest = {
  model: 'openai/gpt-5-chat',
  messages: [{ role: 'user', content: 'Hola' }],
};

const completion: ChatCompletionResponse = {
  id: 'completion-1',
  object: 'chat.completion',
  created: 1,
  model: 'openai/gpt-5-chat',
  choices: [
    {
      index: 0,
      message: { role: 'assistant', content: 'Hola' },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 1,
    completion_tokens: 1,
    total_tokens: 2,
  },
};

describe('chatService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOpenRouterConfig).mockReturnValue({
      url: 'https://openrouter.test/api/v1/chat/completions',
      apiKey: 'sk-or-v1-local',
      siteUrl: 'https://ozyra.test',
      appTitle: 'Ozyra Open',
    });
    vi.mocked(buildOpenRouterHeaders).mockReturnValue({
      Authorization: 'Bearer sk-or-v1-local',
      'Content-Type': 'application/json',
    });
    vi.mocked(buildOpenRouterPayload).mockReturnValue({
      model: request.model,
      messages: request.messages,
      mapped: true,
    });
    vi.mocked(normalizeOpenRouterError).mockImplementation((error) =>
      error instanceof Error ? error : new Error('Error normalizado')
    );
  });

  it('sends mapped payloads to OpenRouter and returns successful completions', async () => {
    vi.mocked(fetchWithRetry).mockResolvedValue(
      new Response(JSON.stringify(completion), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(chatService.createChatCompletion(request)).resolves.toEqual(completion);

    expect(buildOpenRouterPayload).toHaveBeenCalledWith(request);
    expect(fetchWithRetry).toHaveBeenCalledWith('https://openrouter.test/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer sk-or-v1-local',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        mapped: true,
      }),
    });
  });

  it('reads non-ok OpenRouter errors and normalizes the resulting exception', async () => {
    const httpError = new Error('Proveedor caído');
    vi.mocked(fetchWithRetry).mockResolvedValue(new Response('bad', { status: 503 }));
    vi.mocked(readOpenRouterError).mockResolvedValue({
      detail: 'upstream down',
      errorData: { error: { metadata: { provider_name: 'AcmeAI' } } },
    });
    vi.mocked(createOpenRouterHttpError).mockReturnValue(httpError);
    vi.mocked(normalizeOpenRouterError).mockReturnValue(new Error('Normalizado'));

    await expect(chatService.createChatCompletion(request)).rejects.toThrow('Normalizado');

    expect(readOpenRouterError).toHaveBeenCalledWith(expect.objectContaining({ status: 503 }));
    expect(createOpenRouterHttpError).toHaveBeenCalledWith(
      expect.objectContaining({ status: 503 }),
      'upstream down',
      { error: { metadata: { provider_name: 'AcmeAI' } } }
    );
    expect(normalizeOpenRouterError).toHaveBeenCalledWith(httpError);
  });

  it('normalizes OpenRouter error payloads returned with a 200 response', async () => {
    vi.mocked(fetchWithRetry).mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'quota exceeded' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.mocked(normalizeOpenRouterError).mockReturnValue(new Error('Cuota agotada'));

    await expect(chatService.createChatCompletion(request)).rejects.toThrow('Cuota agotada');
    expect(normalizeOpenRouterError).toHaveBeenCalledWith(
      expect.objectContaining({ message: '{"message":"quota exceeded"}' })
    );
  });

  it('delegates streaming requests to the OpenRouter stream adapter', async () => {
    const onChunk = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();
    const onAnnotations = vi.fn();
    const controller = new AbortController();
    vi.mocked(createOpenRouterStream).mockResolvedValue(undefined);

    await chatService.createChatCompletionStream(
      request,
      onChunk,
      onComplete,
      onError,
      onAnnotations,
      controller.signal
    );

    expect(createOpenRouterStream).toHaveBeenCalledWith(
      request,
      {
        onChunk,
        onComplete,
        onError,
        onAnnotations,
      },
      controller.signal
    );
  });

  it('reports health from OpenRouter config availability', async () => {
    await expect(chatService.healthCheck()).resolves.toBe(true);

    vi.mocked(getOpenRouterConfig).mockImplementation(() => {
      throw new Error('missing key');
    });

    await expect(chatService.healthCheck()).resolves.toBe(false);
  });
});
