import type { MessageAnnotation } from '../../types';

export type WebSearchProvider = 'openrouter' | 'tavily' | 'brave';
export type WebSearchContextSize = 'low' | 'medium' | 'high';
export type TavilySearchDepth = 'basic' | 'advanced';

export interface WebSearchSettings {
  readonly provider: WebSearchProvider;
  readonly tavilyApiKey: string;
  readonly braveApiKey: string;
  readonly maxResults: number;
  readonly contextSize: WebSearchContextSize;
  readonly tavilySearchDepth: TavilySearchDepth;
}

export interface WebSearchResult {
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
  readonly publishedDate?: string;
  readonly score?: number;
}

export interface WebSearchResponse {
  readonly provider: Exclude<WebSearchProvider, 'openrouter'>;
  readonly query: string;
  readonly results: readonly WebSearchResult[];
  readonly annotations: readonly MessageAnnotation[];
}
