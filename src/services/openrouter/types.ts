import type { MessageAnnotation } from '../../types';

export type ReasoningLevel = 'low' | 'medium' | 'high';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  images?: Array<{
    url: string;
    contentType: string;
    data?: string;
  }>;
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  model: string;
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  reasoning?: {
    enabled?: boolean;
    effort?: ReasoningLevel;
    max_tokens?: number;
    exclude?: boolean;
  };
  /** Prompt caching automático (Anthropic): breakpoint en el último bloque cacheable */
  cache_control?: { type: 'ephemeral'; ttl?: '5m' | '1h' };
  /** Clave de sticky routing de OpenRouter para reutilizar el cache del proveedor */
  session_id?: string;
  tools?: Array<
    | {
        type: 'function';
        function: {
          name: string;
          description?: string;
          parameters?: Record<string, unknown>;
        };
      }
    | {
        type: 'openrouter:web_search';
        parameters?: {
          engine?: 'native' | 'exa' | 'firecrawl' | 'parallel' | 'perplexity' | 'auto';
          max_results?: number;
          max_total_results?: number;
          search_context_size?: 'low' | 'medium' | 'high';
          allowed_domains?: string[];
          excluded_domains?: string[];
        };
      }
  >;
  tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
}

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      tool_calls?: ToolCall[];
      annotations?: MessageAnnotation[];
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenRouterConfig {
  url: string;
  apiKey: string;
  siteUrl: string;
  appTitle: string;
}

/** Uso de tokens normalizado a partir del objeto `usage` de OpenRouter */
export interface CompletionUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  /** Tokens del prompt servidos desde el cache del proveedor */
  readonly cachedTokens: number;
  /** Tokens escritos en cache (solo proveedores con cache explícito) */
  readonly cacheWriteTokens: number;
  readonly reasoningTokens: number;
  /** Coste total en créditos, si OpenRouter lo informa */
  readonly cost?: number;
}

export interface StreamMetadata {
  readonly finishReason?: string;
  readonly usage?: CompletionUsage;
}

export type StreamCallbacks = {
  onChunk: (chunk: string) => void;
  onComplete: (finalText?: string) => void;
  onError: (error: Error) => void;
  onAnnotations?: (annotations: MessageAnnotation[]) => void;
  /** Se invoca una vez, justo antes de `onComplete`, con el motivo de fin y el uso */
  onMetadata?: (metadata: StreamMetadata) => void;
};
