import type { MessageAnnotation } from '../../types';
import { getWebSearchSettings } from './settings';
import type { WebSearchResponse, WebSearchResult } from './types';

const SEARCH_TIMEOUT_MS = 15000;
const QUERY_MAX_LENGTH = 280;
const CONTEXT_SNIPPET_LIMITS = {
  low: 180,
  medium: 420,
  high: 900,
} as const;

type TavilyResult = {
  title?: unknown;
  url?: unknown;
  content?: unknown;
  score?: unknown;
  published_date?: unknown;
};

type BraveWebResult = {
  title?: unknown;
  url?: unknown;
  description?: unknown;
  age?: unknown;
  page_age?: unknown;
};

function withTimeoutSignal(): AbortSignal | undefined {
  return typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(SEARCH_TIMEOUT_MS)
    : undefined;
}

export function deriveWebSearchQuery(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, QUERY_MAX_LENGTH);
}

function truncateText(text: string, limit: number): string {
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function isValidResult(result: WebSearchResult): boolean {
  return result.title.trim().length > 0 && result.url.startsWith('https://');
}

function toAnnotations(results: readonly WebSearchResult[]): MessageAnnotation[] {
  return results.map((result) => ({
    type: 'url_citation',
    url_citation: {
      url: result.url,
      title: result.title,
      content: result.snippet,
      confidence: result.score
        ? Math.round(Math.max(0, Math.min(result.score, 1)) * 100)
        : undefined,
    },
  }));
}

function normalizeTavilyResult(result: TavilyResult): WebSearchResult | null {
  if (typeof result.title !== 'string' || typeof result.url !== 'string') {
    return null;
  }

  const normalized: WebSearchResult = {
    title: result.title,
    url: result.url,
    snippet: typeof result.content === 'string' ? result.content : '',
    publishedDate: typeof result.published_date === 'string' ? result.published_date : undefined,
    score: typeof result.score === 'number' ? result.score : undefined,
  };

  return isValidResult(normalized) ? normalized : null;
}

function normalizeBraveResult(result: BraveWebResult): WebSearchResult | null {
  if (typeof result.title !== 'string' || typeof result.url !== 'string') {
    return null;
  }

  const normalized: WebSearchResult = {
    title: result.title,
    url: result.url,
    snippet: typeof result.description === 'string' ? result.description : '',
    publishedDate:
      typeof result.age === 'string'
        ? result.age
        : typeof result.page_age === 'string'
          ? result.page_age
          : undefined,
  };

  return isValidResult(normalized) ? normalized : null;
}

async function searchTavily(
  query: string,
  apiKey: string,
  maxResults: number,
  searchDepth: 'basic' | 'advanced'
): Promise<WebSearchResponse> {
  if (!apiKey) {
    throw new Error('Configura una clave de Tavily en Ajustes > Búsqueda.');
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: searchDepth,
      include_answer: false,
      include_raw_content: false,
      max_results: maxResults,
    }),
    signal: withTimeoutSignal(),
  });

  if (!response.ok) {
    throw new Error(`Tavily rechazó la búsqueda (${response.status}). Revisa la clave o límites.`);
  }

  const data = (await response.json()) as { results?: TavilyResult[] };
  const results = (data.results ?? [])
    .map(normalizeTavilyResult)
    .filter((result): result is WebSearchResult => result !== null)
    .slice(0, maxResults);

  return {
    provider: 'tavily',
    query,
    results,
    annotations: toAnnotations(results),
  };
}

async function searchBrave(
  query: string,
  apiKey: string,
  maxResults: number
): Promise<WebSearchResponse> {
  if (!apiKey) {
    throw new Error('Configura una clave de Brave Search en Ajustes > Búsqueda.');
  }

  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(maxResults));
  url.searchParams.set('text_decorations', 'false');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': apiKey,
    },
    signal: withTimeoutSignal(),
  });

  if (!response.ok) {
    throw new Error(
      `Brave Search rechazó la búsqueda (${response.status}). Revisa la clave o límites.`
    );
  }

  const data = (await response.json()) as { web?: { results?: BraveWebResult[] } };
  const results = (data.web?.results ?? [])
    .map(normalizeBraveResult)
    .filter((result): result is WebSearchResult => result !== null)
    .slice(0, maxResults);

  return {
    provider: 'brave',
    query,
    results,
    annotations: toAnnotations(results),
  };
}

export async function runDirectWebSearch(query: string): Promise<WebSearchResponse | null> {
  const settings = getWebSearchSettings();
  const normalizedQuery = deriveWebSearchQuery(query);

  if (settings.provider === 'openrouter') {
    return null;
  }

  if (!normalizedQuery) {
    throw new Error('Escribe una consulta con texto para usar búsqueda web.');
  }

  if (settings.provider === 'tavily') {
    return searchTavily(
      normalizedQuery,
      settings.tavilyApiKey,
      settings.maxResults,
      settings.tavilySearchDepth
    );
  }

  return searchBrave(normalizedQuery, settings.braveApiKey, settings.maxResults);
}

export function buildWebSearchContext(search: WebSearchResponse): string {
  const settings = getWebSearchSettings();
  const snippetLimit = CONTEXT_SNIPPET_LIMITS[settings.contextSize];
  const lines = search.results.map((result, index) => {
    const published = result.publishedDate ? `\nFecha: ${result.publishedDate}` : '';
    const snippet = result.snippet
      ? `\nExtracto: ${truncateText(result.snippet, snippetLimit)}`
      : '';
    return `[${index + 1}] ${result.title}\nURL: ${result.url}${published}${snippet}`;
  });

  return [
    `Contexto de búsqueda web (${search.provider}) para la consulta: "${search.query}".`,
    `Fecha actual: ${new Date().toISOString().slice(0, 10)}.`,
    'Instrucciones: usa estas fuentes solo cuando sean relevantes, no inventes citas y prioriza fuentes recientes cuando la pregunta sea temporal.',
    ...lines,
  ].join('\n\n');
}
