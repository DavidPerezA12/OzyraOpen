import { beforeEach, describe, expect, it } from 'vitest';

import { STORAGE_KEYS } from '../../config/constants';
import { getWebSearchSettings, saveWebSearchSettings } from './settings';

describe('web search settings', () => {
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

  it('defaults to OpenRouter without extra keys', () => {
    expect(getWebSearchSettings()).toMatchObject({
      provider: 'openrouter',
      tavilyApiKey: '',
      braveApiKey: '',
      maxResults: 5,
      contextSize: 'medium',
      tavilySearchDepth: 'basic',
    });
  });

  it('persists provider and local API keys', () => {
    saveWebSearchSettings({
      provider: 'tavily',
      tavilyApiKey: 'tvly-local',
      braveApiKey: 'brave-local',
      maxResults: 8,
      contextSize: 'high',
      tavilySearchDepth: 'advanced',
    });

    expect(window.localStorage.getItem(STORAGE_KEYS.WEB_SEARCH_PROVIDER)).toBe('tavily');
    expect(getWebSearchSettings()).toMatchObject({
      provider: 'tavily',
      tavilyApiKey: 'tvly-local',
      braveApiKey: 'brave-local',
      maxResults: 8,
      contextSize: 'high',
      tavilySearchDepth: 'advanced',
    });
  });
});
