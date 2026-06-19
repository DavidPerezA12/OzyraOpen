/**
 * CHAT SERVICE - CLIENTE OPENROUTER LOCAL
 *
 * Fachada pública para llamadas de chat directas contra OpenRouter desde el
 * navegador. La implementación vive en módulos pequeños bajo services/openrouter
 * y services/chat para mantener estable esta API de importación.
 */

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
import type { MessageAnnotation } from '../types';

export type { ChatCompletionRequest, ChatMessage } from './openrouter/types';

class SecureChatService {
  private static instance: SecureChatService;

  private constructor() {}

  public static getInstance(): SecureChatService {
    if (!SecureChatService.instance) {
      SecureChatService.instance = new SecureChatService();
    }
    return SecureChatService.instance;
  }

  async createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    try {
      const config = getOpenRouterConfig();
      const response = await fetchWithRetry(config.url, {
        method: 'POST',
        headers: buildOpenRouterHeaders(),
        body: JSON.stringify(buildOpenRouterPayload(request)),
      });

      if (!response.ok) {
        const { detail, errorData } = await readOpenRouterError(response);
        throw createOpenRouterHttpError(response, detail, errorData);
      }

      const data = await response.json();

      if (data?.error) {
        throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
      }

      return data as ChatCompletionResponse;
    } catch (error) {
      console.error('[ChatService] Error en createChatCompletion:', error);
      throw normalizeOpenRouterError(error);
    }
  }

  async createChatCompletionStream(
    request: ChatCompletionRequest,
    onChunk: (chunk: string) => void,
    onComplete: (finalText?: string) => void,
    onError: (error: Error) => void,
    onAnnotations?: (annotations: MessageAnnotation[]) => void,
    signal?: AbortSignal
  ): Promise<void> {
    await createOpenRouterStream(
      request,
      {
        onChunk,
        onComplete,
        onError,
        onAnnotations,
      },
      signal
    );
  }

  async healthCheck(): Promise<boolean> {
    try {
      getOpenRouterConfig();
      return true;
    } catch {
      return false;
    }
  }
}

export const chatService = SecureChatService.getInstance();
