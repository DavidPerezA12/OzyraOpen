import {
  chatService,
  type ChatCompletionRequest,
  type CompletionUsage,
  type StreamMetadata,
} from '../chatService';
import type { WebSearchResponse } from '../search/types';
import type { Message, MessageAnnotation } from '../../types';
import { splitReasoningChunk, stripReasoningMarkers } from '../../utils/reasoningStream';
import { buildAssistantMessage } from './generationPipeline';
import { logger } from '../../utils/logger';

export type AssistantDraftUpdate = Partial<{
  partialResponse: string | null;
  thinkingProcessContent: string | null;
}>;

export interface AssistantStreamResult {
  readonly message: Message;
  /** `length` indica que la respuesta se cortó por `max_tokens` */
  readonly finishReason?: string;
  readonly usage?: CompletionUsage;
}

/**
 * Registra el uso de tokens de la petición, incluido el aprovechamiento del
 * prompt cache, para poder verificarlo desde la consola en desarrollo.
 */
const logCompletionUsage = (model: string, metadata: StreamMetadata): void => {
  const usage = metadata.usage;
  if (!usage) {
    return;
  }
  logger.info('[PromptCache] Uso de tokens', {
    model,
    finishReason: metadata.finishReason,
    promptTokens: usage.promptTokens,
    cachedTokens: usage.cachedTokens,
    cacheWriteTokens: usage.cacheWriteTokens,
    cacheHitRatio:
      usage.promptTokens > 0 ? Number((usage.cachedTokens / usage.promptTokens).toFixed(3)) : 0,
    completionTokens: usage.completionTokens,
    reasoningTokens: usage.reasoningTokens,
    cost: usage.cost,
  });
};

export interface RunAssistantStreamParams {
  readonly assistantMessageId: string;
  readonly submittedModel: string;
  readonly useWebSearch: boolean;
  readonly directWebSearch: WebSearchResponse | null;
  readonly streamRequest: ChatCompletionRequest;
  /** Al abortarse, el stream se corta y no se emiten más actualizaciones del borrador */
  readonly signal: AbortSignal;
  readonly onDraftUpdate: (updates: AssistantDraftUpdate) => void;
}

const buildAnnotationMap = (
  directWebSearch: WebSearchResponse | null
): Map<string, MessageAnnotation> => {
  const annotationsByUrl = new Map<string, MessageAnnotation>();
  directWebSearch?.annotations.forEach((annotation) => {
    annotationsByUrl.set(annotation.url_citation.url, annotation);
  });
  return annotationsByUrl;
};

export async function runAssistantStream({
  assistantMessageId,
  submittedModel,
  useWebSearch,
  directWebSearch,
  streamRequest,
  signal,
  onDraftUpdate,
}: RunAssistantStreamParams): Promise<AssistantStreamResult> {
  let accumulatedResponse = '';
  let accumulatedThinking = '';
  let inReasoning = false;
  let dirtyResponse = false;
  let dirtyThinking = false;
  let scheduledFlush: (() => void) | null = null;

  const webAnnotationsByUrl = buildAnnotationMap(directWebSearch);
  const collectWebAnnotations = (annotations: MessageAnnotation[]) => {
    for (const annotation of annotations) {
      webAnnotationsByUrl.set(annotation.url_citation.url, annotation);
    }
  };

  const flushNow = () => {
    const cancelScheduledFlush = scheduledFlush;
    scheduledFlush = null;
    cancelScheduledFlush?.();
    if (signal.aborted) {
      dirtyResponse = false;
      dirtyThinking = false;
      return;
    }

    const updates: AssistantDraftUpdate = {};
    if (dirtyResponse) {
      updates.partialResponse = accumulatedResponse;
    }
    if (dirtyThinking) {
      updates.thinkingProcessContent = accumulatedThinking;
    }

    dirtyResponse = false;
    dirtyThinking = false;

    if (Object.keys(updates).length > 0) {
      onDraftUpdate(updates);
    }
  };

  // Agrupa los chunks en una actualización por frame para no re-renderizar
  // el chat completo con cada token.
  const scheduleFlush = () => {
    if (scheduledFlush) {
      return;
    }
    let fired = false;
    const run = () => {
      fired = true;
      flushNow();
    };
    if (typeof window.requestAnimationFrame === 'function') {
      const frame = window.requestAnimationFrame(run);
      // Si el callback ya se ejecutó de forma síncrona no queda nada pendiente.
      if (!fired) {
        scheduledFlush = () => window.cancelAnimationFrame(frame);
      }
    } else {
      const timeout = window.setTimeout(run, 16);
      scheduledFlush = () => window.clearTimeout(timeout);
    }
  };

  const appendStreamChunk = (chunk: string) => {
    const parsed = splitReasoningChunk(chunk, inReasoning);
    inReasoning = parsed.isReasoning;

    if (parsed.responseDelta) {
      accumulatedResponse += parsed.responseDelta;
      dirtyResponse = true;
    }

    if (parsed.thinkingDelta) {
      accumulatedThinking += parsed.thinkingDelta;
      dirtyThinking = true;
    }

    if (parsed.responseDelta || parsed.thinkingDelta) {
      scheduleFlush();
    }
  };

  let resolveFinalText!: (text: string) => void;
  let rejectFinalText!: (error: Error) => void;
  const finalTextPromise = new Promise<string>((resolve, reject) => {
    resolveFinalText = resolve;
    rejectFinalText = reject;
  });

  let metadata: StreamMetadata = {};

  await chatService.createChatCompletionStream(
    streamRequest,
    {
      onChunk: appendStreamChunk,
      onComplete: () => {
        flushNow();
        // Resolver siempre: si el run quedó obsoleto (nuevo stream o cancel),
        // el llamador decide qué hacer con el texto parcial en lugar de colgarse.
        resolveFinalText(stripReasoningMarkers(accumulatedResponse));
      },
      onError: (error: Error) => {
        logger.error('Error en stream:', error);
        flushNow();
        rejectFinalText(error);
      },
      onAnnotations: collectWebAnnotations,
      onMetadata: (streamMetadata) => {
        metadata = streamMetadata;
        logCompletionUsage(streamRequest.model, streamMetadata);
      },
    },
    signal
  );

  const finalAssistantText = await finalTextPromise;
  const finalVisibleText = stripReasoningMarkers(finalAssistantText);
  const webAnnotations = Array.from(webAnnotationsByUrl.values());
  const webSearchQueries = directWebSearch ? [directWebSearch.query] : undefined;

  return {
    message: buildAssistantMessage({
      id: assistantMessageId,
      content: finalVisibleText,
      model: submittedModel,
      thinkingContent: accumulatedThinking || undefined,
      useWebSearch: useWebSearch || undefined,
      searchQueries: webSearchQueries,
      annotations: webAnnotations.length > 0 ? webAnnotations : undefined,
    }),
    finishReason: metadata.finishReason,
    usage: metadata.usage,
  };
}
