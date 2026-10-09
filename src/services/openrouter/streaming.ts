import { buildOpenRouterPayload } from './buildPayload';
import { t } from '../../i18n';
import { escapeThinkingMarkers } from '../../utils/reasoningStream';
import {
  buildOpenRouterHeaders,
  createOpenRouterHttpError,
  fetchWithRetry,
  getOpenRouterConfig,
  readOpenRouterError,
} from './client';
import type { ChatCompletionRequest, CompletionUsage, StreamCallbacks } from './types';
import type { MessageAnnotation } from '../../types';
import { isRecord } from '../../utils/typeGuards';
import { logger } from '../../utils/logger';

type StreamDelta = {
  content?: unknown;
  reasoning?: unknown;
  reasoning_details?: unknown;
  annotations?: unknown;
};

function asStreamDelta(value: unknown): StreamDelta {
  return value && typeof value === 'object' ? (value as StreamDelta) : {};
}

function readReasoningDelta(delta: StreamDelta): string {
  let reasoningDelta = '';
  const reasoning = delta?.reasoning;

  if (typeof reasoning === 'string') {
    reasoningDelta = reasoning;
  } else if (reasoning && typeof reasoning === 'object') {
    const reasoningObject = reasoning as { content?: unknown };
    if (typeof reasoningObject.content === 'string') {
      reasoningDelta = reasoningObject.content;
    }
  }

  if (!reasoningDelta && Array.isArray(delta?.reasoning_details)) {
    try {
      const reasoningDetails = delta.reasoning_details as Array<{
        text?: unknown;
        summary?: unknown;
      }>;

      for (const item of reasoningDetails) {
        if (item && typeof item.text === 'string') {
          reasoningDelta += item.text;
        } else if (item && typeof item.summary === 'string') {
          reasoningDelta += item.summary;
        }
      }

      if (reasoningDelta) {
        logger.info('[ChatService] reasoning_details detected in stream');
      }
    } catch {
      // noop
    }
  }

  return reasoningDelta;
}

function isUrlCitationAnnotation(value: unknown): value is MessageAnnotation {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const annotation = value as {
    type?: unknown;
    url_citation?: {
      url?: unknown;
      title?: unknown;
    };
  };

  return (
    annotation.type === 'url_citation' &&
    typeof annotation.url_citation?.url === 'string' &&
    typeof annotation.url_citation?.title === 'string'
  );
}

function readAnnotations(value: unknown): MessageAnnotation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isUrlCitationAnnotation);
}

const readTokenCount = (source: Record<string, unknown> | null, key: string): number => {
  const value = source?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

/** Normaliza el objeto `usage` que OpenRouter envía en el último chunk del stream. */
function readCompletionUsage(value: unknown): CompletionUsage | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const promptDetails = isRecord(value.prompt_tokens_details) ? value.prompt_tokens_details : null;
  const completionDetails = isRecord(value.completion_tokens_details)
    ? value.completion_tokens_details
    : null;

  return {
    promptTokens: readTokenCount(value, 'prompt_tokens'),
    completionTokens: readTokenCount(value, 'completion_tokens'),
    cachedTokens: readTokenCount(promptDetails, 'cached_tokens'),
    cacheWriteTokens: readTokenCount(promptDetails, 'cache_write_tokens'),
    reasoningTokens: readTokenCount(completionDetails, 'reasoning_tokens'),
    ...(typeof value.cost === 'number' ? { cost: value.cost } : {}),
  };
}

/** Error enviado por OpenRouter dentro del stream (p. ej. el proveedor falla a mitad). */
function readStreamError(value: unknown): Error | null {
  if (!isRecord(value)) {
    return null;
  }
  const message = typeof value.message === 'string' && value.message ? value.message : null;
  return new Error(message ?? t('unknownError'));
}

type StreamChunk = {
  choices?: Array<{ delta?: unknown; finish_reason?: unknown }>;
  usage?: unknown;
  error?: unknown;
};

export async function createOpenRouterStream(
  request: ChatCompletionRequest,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const { onChunk, onComplete, onError, onAnnotations, onMetadata } = callbacks;

  try {
    const streamRequest = { ...request, stream: true };
    const config = getOpenRouterConfig();
    // Cualquier configuración de razonamiento (enabled, effort o max_tokens)
    // lo activa, salvo que se pida explícitamente excluirlo de la respuesta.
    const allowReasoning = Boolean(streamRequest.reasoning) && !streamRequest.reasoning?.exclude;

    logger.info('[ChatService] createChatCompletionStream start', {
      model: streamRequest.model,
      hasReasoning: Boolean(streamRequest.reasoning),
      allowReasoning,
      reasoningKeys: streamRequest.reasoning ? Object.keys(streamRequest.reasoning) : [],
    });

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: buildOpenRouterHeaders(),
      body: JSON.stringify(buildOpenRouterPayload(streamRequest)),
    };

    if (signal) {
      fetchOptions.signal = signal;
    }

    const response = await fetchWithRetry(config.url, fetchOptions);

    if (!response.ok) {
      const { detail, errorData } = await readOpenRouterError(response);
      throw createOpenRouterHttpError(response, detail, errorData);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error(t('streamReaderError'));
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let inReasoning = false;
    let finishReason: string | undefined;
    let usage: CompletionUsage | undefined;
    const MAX_STREAM_BUFFER = 1_000_000;

    const finish = () => {
      if (inReasoning) {
        onChunk('</thinking>');
        inReasoning = false;
      }
      onMetadata?.({ finishReason, usage });
      onComplete(fullText);
    };

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (signal?.aborted) {
          try {
            await reader.cancel();
          } catch {
            // noop: el lector ya puede estar cerrado.
          }
          throw new DOMException('Streaming request aborted', 'AbortError');
        }

        if (done) {
          finish();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        // Evitar crecimiento ilimitado si el proveedor envía una línea gigante.
        if (buffer.length > MAX_STREAM_BUFFER) {
          buffer = buffer.slice(-MAX_STREAM_BUFFER);
        }
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) {
            continue;
          }

          const data = line.slice(6);

          if (data === '[DONE]') {
            finish();
            return;
          }

          let parsed: StreamChunk;
          try {
            parsed = JSON.parse(data) as StreamChunk;
          } catch (parseError) {
            logger.warn('Error parsing stream chunk:', { detail: parseError });
            continue;
          }

          const streamError = readStreamError(parsed.error);
          if (streamError) {
            throw streamError;
          }

          const choice = parsed.choices?.[0];
          if (typeof choice?.finish_reason === 'string') {
            finishReason = choice.finish_reason;
          }
          usage = readCompletionUsage(parsed.usage) ?? usage;

          const delta = asStreamDelta(choice?.delta);
          const reasoningDelta = readReasoningDelta(delta);

          if (reasoningDelta && allowReasoning) {
            if (!inReasoning) {
              onChunk('<thinking>');
              inReasoning = true;
              logger.info('[ChatService] Reasoning block started');
            }
            onChunk(reasoningDelta);
          }

          const content = typeof delta.content === 'string' ? delta.content : '';
          if (content) {
            if (inReasoning) {
              onChunk('</thinking>');
              inReasoning = false;
              logger.info('[ChatService] Reasoning block closed');
            }
            // Neutralizar marcadores inyectados por el modelo: solo la app
            // puede abrir/cerrar bloques de razonamiento en esta banda.
            const safeContent = escapeThinkingMarkers(content);
            fullText += safeContent;
            onChunk(safeContent);
          }

          const annotations = readAnnotations(delta.annotations);
          if (annotations.length > 0) {
            onAnnotations?.(annotations);
          }
        }
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // noop: el lector puede estar ya liberado tras un abort.
      }
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(t('unknownError'));

    if (err.name === 'AbortError') {
      logger.info('[ChatService] Streaming abortado por señal.');
      onError(err);
      return;
    }

    logger.error('Error en createChatCompletionStream:', err);
    onError(err);
  }
}
