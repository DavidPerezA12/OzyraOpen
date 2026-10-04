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
import type { ChatCompletionRequest, StreamCallbacks } from './types';
import type { MessageAnnotation } from '../../types';
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

export async function createOpenRouterStream(
  request: ChatCompletionRequest,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const { onChunk, onComplete, onError, onAnnotations } = callbacks;

  try {
    const streamRequest = { ...request, stream: true };
    const config = getOpenRouterConfig();
    const allowReasoning = Boolean(streamRequest?.reasoning?.enabled);

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
    const MAX_STREAM_BUFFER = 1_000_000;

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
          if (inReasoning) {
            onChunk('</thinking>');
            inReasoning = false;
          }

          onComplete(fullText);
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
            if (inReasoning) {
              onChunk('</thinking>');
              inReasoning = false;
            }

            onComplete(fullText);
            return;
          }

          try {
            const parsed = JSON.parse(data) as { choices?: Array<{ delta?: unknown }> };
            const delta = asStreamDelta(parsed.choices?.[0]?.delta);
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
          } catch (parseError) {
            logger.warn('Error parsing stream chunk:', { detail: parseError });
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
