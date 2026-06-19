import type { MessageAnnotation } from '../../types';

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
    effort?: 'low' | 'medium' | 'high';
    max_tokens?: number;
    exclude?: boolean;
  };
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

export type StreamCallbacks = {
  onChunk: (chunk: string) => void;
  onComplete: (finalText?: string) => void;
  onError: (error: Error) => void;
  onAnnotations?: (annotations: MessageAnnotation[]) => void;
};
