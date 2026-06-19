import { STORAGE_KEYS } from '../../config/constants';
import type {
  TavilySearchDepth,
  WebSearchContextSize,
  WebSearchProvider,
  WebSearchSettings,
} from './types';

const PROVIDERS: readonly WebSearchProvider[] = ['openrouter', 'tavily', 'brave'];
const CONTEXT_SIZES: readonly WebSearchContextSize[] = ['low', 'medium', 'high'];
const TAVILY_DEPTHS: readonly TavilySearchDepth[] = ['basic', 'advanced'];
const RESULT_COUNTS = [3, 5, 8] as const;

const readLocalValue = (key: string): string => {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return window.localStorage.getItem(key)?.trim() ?? '';
  } catch {
    return '';
  }
};

const normalizeProvider = (value: string | null | undefined): WebSearchProvider => {
  return PROVIDERS.includes(value as WebSearchProvider)
    ? (value as WebSearchProvider)
    : 'openrouter';
};

const normalizeContextSize = (value: string | null | undefined): WebSearchContextSize =>
  CONTEXT_SIZES.includes(value as WebSearchContextSize)
    ? (value as WebSearchContextSize)
    : 'medium';

const normalizeTavilyDepth = (value: string | null | undefined): TavilySearchDepth =>
  TAVILY_DEPTHS.includes(value as TavilySearchDepth) ? (value as TavilySearchDepth) : 'basic';

const normalizeMaxResults = (value: string | null | undefined): number => {
  const parsed = Number(value);
  return RESULT_COUNTS.includes(parsed as (typeof RESULT_COUNTS)[number]) ? parsed : 5;
};

export function getWebSearchSettings(): WebSearchSettings {
  return {
    provider: normalizeProvider(readLocalValue(STORAGE_KEYS.WEB_SEARCH_PROVIDER)),
    tavilyApiKey:
      readLocalValue(STORAGE_KEYS.TAVILY_API_KEY) || import.meta.env.VITE_TAVILY_API_KEY || '',
    braveApiKey:
      readLocalValue(STORAGE_KEYS.BRAVE_SEARCH_API_KEY) ||
      import.meta.env.VITE_BRAVE_SEARCH_API_KEY ||
      '',
    maxResults: normalizeMaxResults(readLocalValue(STORAGE_KEYS.WEB_SEARCH_MAX_RESULTS)),
    contextSize: normalizeContextSize(readLocalValue(STORAGE_KEYS.WEB_SEARCH_CONTEXT_SIZE)),
    tavilySearchDepth: normalizeTavilyDepth(readLocalValue(STORAGE_KEYS.WEB_SEARCH_TAVILY_DEPTH)),
  };
}

export function saveWebSearchSettings(settings: WebSearchSettings): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEYS.WEB_SEARCH_PROVIDER, settings.provider);

  if (settings.tavilyApiKey.trim()) {
    window.localStorage.setItem(STORAGE_KEYS.TAVILY_API_KEY, settings.tavilyApiKey.trim());
  } else {
    window.localStorage.removeItem(STORAGE_KEYS.TAVILY_API_KEY);
  }

  if (settings.braveApiKey.trim()) {
    window.localStorage.setItem(STORAGE_KEYS.BRAVE_SEARCH_API_KEY, settings.braveApiKey.trim());
  } else {
    window.localStorage.removeItem(STORAGE_KEYS.BRAVE_SEARCH_API_KEY);
  }

  window.localStorage.setItem(STORAGE_KEYS.WEB_SEARCH_MAX_RESULTS, String(settings.maxResults));
  window.localStorage.setItem(STORAGE_KEYS.WEB_SEARCH_CONTEXT_SIZE, settings.contextSize);
  window.localStorage.setItem(STORAGE_KEYS.WEB_SEARCH_TAVILY_DEPTH, settings.tavilySearchDepth);
}
