import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { STORAGE_KEYS } from '../../config/constants';
import {
  fetchWithRetry,
  getOpenRouterConfig,
  getStoredOpenRouterApiKey,
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
    expect(() => getOpenRouterConfig()).toThrow(
      'Configura tu clave de OpenRouter en Ajustes > Perfil local.'
    );
  });

  it('builds the client config from the locally stored key', () => {
    saveOpenRouterApiKey('sk-or-v1-local');

    expect(getOpenRouterConfig().apiKey).toBe('sk-or-v1-local');
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
});
