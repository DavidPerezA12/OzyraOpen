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
import { parseChatCompletionResponse } from './openrouter/responseValidation';
import type { ChatCompletionRequest, ChatCompletionResponse } from './openrouter/types';
import type { MessageAnnotation } from '../types';
import { logger } from '../utils/logger';

export type { ChatCompletionRequest, ChatMessage } from './openrouter/types';

const readChatCompletionResponse = async (response: Response): Promise<ChatCompletionResponse> => {
  let data: unknown;
  try {
    data = (await response.json()) as unknown;
  } catch {
    throw new Error('Invalid chat completion response: body is not valid JSON');
  }

  return parseChatCompletionResponse(data);
};

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

      return await readChatCompletionResponse(response);
    } catch (error) {
      logger.error('[ChatService] Error en createChatCompletion:', error);
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
