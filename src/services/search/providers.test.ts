import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STORAGE_KEYS } from '../../config/constants';
import { buildWebSearchContext, deriveWebSearchQuery, runDirectWebSearch } from './providers';

describe('web search providers', () => {
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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns null for the OpenRouter provider', async () => {
    window.localStorage.setItem(STORAGE_KEYS.WEB_SEARCH_PROVIDER, 'openrouter');

    await expect(runDirectWebSearch('latest ai news')).resolves.toBeNull();
  });

  it('normalizes Tavily results into citations', async () => {
    window.localStorage.setItem(STORAGE_KEYS.WEB_SEARCH_PROVIDER, 'tavily');
    window.localStorage.setItem(STORAGE_KEYS.TAVILY_API_KEY, 'tvly-test');
    window.localStorage.setItem(STORAGE_KEYS.WEB_SEARCH_MAX_RESULTS, '8');
    window.localStorage.setItem(STORAGE_KEYS.WEB_SEARCH_TAVILY_DEPTH, 'advanced');
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            title: 'Tavily result',
            url: 'https://example.com/tavily',
            content: 'Useful summary',
            score: 0.9,
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const response = await runDirectWebSearch('query');

    expect(response).toMatchObject({
      provider: 'tavily',
      results: [{ title: 'Tavily result', url: 'https://example.com/tavily' }],
      annotations: [
        {
          type: 'url_citation',
          url_citation: {
            url: 'https://example.com/tavily',
            title: 'Tavily result',
            content: 'Useful summary',
            confidence: 90,
          },
        },
      ],
    });
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toMatchObject({
      max_results: 8,
      search_depth: 'advanced',
    });
  });

  it('normalizes Brave results and builds system context', async () => {
    window.localStorage.setItem(STORAGE_KEYS.WEB_SEARCH_PROVIDER, 'brave');
    window.localStorage.setItem(STORAGE_KEYS.BRAVE_SEARCH_API_KEY, 'brave-test');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          web: {
            results: [
              {
                title: 'Brave result',
                url: 'https://example.com/brave',
                description: 'Search snippet',
              },
            ],
          },
        }),
      })
    );

    const response = await runDirectWebSearch('query');

    expect(response?.provider).toBe('brave');
    expect(response?.results[0]).toMatchObject({
      title: 'Brave result',
      url: 'https://example.com/brave',
      snippet: 'Search snippet',
    });
    expect(response ? buildWebSearchContext(response) : '').toContain('Brave result');
  });

  it('derives compact search queries from long prompts', () => {
    expect(
      deriveWebSearchQuery('Busca esto https://example.com\n```ts\nconst x = 1\n```\n con detalle')
    ).toBe('Busca esto con detalle');
  });
});
