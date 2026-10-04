import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_CONFIG, STORAGE_KEYS } from '../../config/constants';
import { t } from '../../i18n';
import {
  OpenRouterHttpError,
  buildOpenRouterHeaders,
  createOpenRouterHttpError,
  fetchOpenRouterModels,
  fetchWithRetry,
  getOpenRouterConfig,
  getStoredOpenRouterApiKey,
  normalizeOpenRouterError,
  readOpenRouterError,
  saveOpenRouterApiKey,
} from './client';

describe('OpenRouter API key storage', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
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
      },
    });
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns an empty string when no key is stored', () => {
    expect(getStoredOpenRouterApiKey()).toBe('');
  });

  it('persists a trimmed key and reads it back', () => {
    saveOpenRouterApiKey('  sk-or-v1-abc  ');

    expect(window.localStorage.getItem(STORAGE_KEYS.OPENROUTER_API_KEY)).toBe('sk-or-v1-abc');
    expect(getStoredOpenRouterApiKey()).toBe('sk-or-v1-abc');
  });

  it('removes the stored key when saving an empty value', () => {
    saveOpenRouterApiKey('sk-or-v1-abc');
    saveOpenRouterApiKey('   ');

    expect(window.localStorage.getItem(STORAGE_KEYS.OPENROUTER_API_KEY)).toBeNull();
    expect(getStoredOpenRouterApiKey()).toBe('');
  });

  it('requires a locally stored key instead of embedding one in the bundle', () => {
    expect(() => getOpenRouterConfig()).toThrow(t('missingOpenRouterKey'));
  });

  it('builds the client config from the locally stored key', () => {
    saveOpenRouterApiKey('sk-or-v1-local');

    expect(getOpenRouterConfig().apiKey).toBe('sk-or-v1-local');
  });

  it('builds OpenRouter headers from the stored key and browser origin', () => {
    saveOpenRouterApiKey('sk-or-v1-local');

    expect(buildOpenRouterHeaders()).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer sk-or-v1-local',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Ozyra Open',
    });
  });

  it('does not retry requests whose caller signal is already aborted', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    controller.abort();

    await expect(
      fetchWithRetry('https://example.test', { signal: controller.signal })
    ).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries retryable HTTP responses with backoff', async () => {
    vi.useFakeTimers();
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const request = fetchWithRetry('https://example.test/chat', { method: 'POST' });
    await vi.advanceTimersByTimeAsync(API_CONFIG.RETRY_DELAY);

    await expect(request).resolves.toMatchObject({ status: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('Error 503'));
  });

  it('stops an HTTP retry backoff when the caller aborts', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    let resolveFetch: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    const request = fetchWithRetry('https://example.test/chat', {
      method: 'POST',
      signal: controller.signal,
    });
    resolveFetch(new Response('', { status: 503 }));
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries transient network errors before succeeding', async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const request = fetchWithRetry('https://example.test/chat', { method: 'POST' });
    await vi.advanceTimersByTimeAsync(API_CONFIG.RETRY_DELAY);

    await expect(request).resolves.toMatchObject({ status: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Error de red'));
  });

  it('extracts provider details from structured OpenRouter errors', async () => {
    const errorPayload = {
      error: {
        message: 'Provider unavailable',
        metadata: { provider_name: 'AcmeAI' },
      },
    };

    await expect(
      readOpenRouterError(new Response(JSON.stringify(errorPayload), { status: 503 }))
    ).resolves.toEqual({
      detail: 'Provider unavailable (AcmeAI)',
      errorData: errorPayload,
    });
  });

  it('preserves plain text error bodies that are not JSON', async () => {
    await expect(
      readOpenRouterError(new Response('upstream overloaded', { status: 502 }))
    ).resolves.toEqual({
      detail: 'upstream overloaded',
      errorData: null,
    });
  });

  it('maps HTTP error responses to user-facing messages', () => {
    const providerError = createOpenRouterHttpError(new Response('', { status: 503 }), '', {
      error: { metadata: { provider_name: 'AcmeAI' } },
    });
    const badRequest = createOpenRouterHttpError(
      new Response('', { status: 400 }),
      'model missing',
      null
    );
    const timeout = createOpenRouterHttpError(new Response('', { status: 504 }), '', null);
    const unknown = createOpenRouterHttpError(new Response('', { status: 418 }), 'teapot', null);

    expect(providerError.message).toBe(
      t('openRouterProviderDown', { provider: 'AcmeAI', retries: API_CONFIG.MAX_RETRIES })
    );
    expect(badRequest.message).toBe(t('openRouterBadRequest', { detail: 'model missing' }));
    expect(timeout.message).toBe(t('timeoutError'));
    expect(unknown.message).toBe(t('openRouterServerError', { status: 418, detail: 'teapot' }));
  });

  it('normalizes common browser fetch failures', () => {
    const abortError = new Error('Request aborted');
    abortError.name = 'AbortError';
    const providerError = new OpenRouterHttpError('Provider is temporarily saturated', 503);

    expect(normalizeOpenRouterError(abortError).message).toBe(t('timeoutError'));
    expect(normalizeOpenRouterError(new TypeError('Failed to fetch')).message).toBe(
      t('networkError')
    );
    expect(normalizeOpenRouterError(providerError)).toBe(providerError);
    expect(normalizeOpenRouterError('nope').message).toBe(t('unknownError'));
  });

  it('fetches public text models without credential headers when no key is stored', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'openai/gpt-test' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchOpenRouterModels()).resolves.toEqual([{ id: 'openai/gpt-test' }]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedUrl = new URL(url);
    expect(parsedUrl.pathname).toBe('/api/v1/models');
    expect(parsedUrl.searchParams.get('input_modalities')).toBe('text');
    expect(parsedUrl.searchParams.get('output_modalities')).toBe('text');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('uses credential headers when fetching models with a stored key', async () => {
    saveOpenRouterApiKey('sk-or-v1-local');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchOpenRouterModels()).resolves.toEqual([]);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer sk-or-v1-local',
      'HTTP-Referer': window.location.origin,
    });
  });

  it('rejects invalid OpenRouter model catalog payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    await expect(fetchOpenRouterModels()).rejects.toThrow(
      'Invalid response format from OpenRouter models endpoint'
    );
  });
});
