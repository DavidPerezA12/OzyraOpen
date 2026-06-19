import { chatService, type ChatCompletionRequest } from '../chatService';
import type { WebSearchResponse } from '../search/types';
import type { Message, MessageAnnotation } from '../../types';
import { splitReasoningChunk, stripReasoningMarkers } from '../../utils/reasoningStream';
import { buildAssistantMessage } from './generationPipeline';

export type AssistantDraftUpdate = Partial<{
  partialResponse: string | null;
  thinkingProcessContent: string | null;
}>;

type MutableStore<T> = {
  current: T;
};

export interface RunAssistantStreamParams {
  readonly chatId: string;
  readonly assistantMessageId: string;
  readonly submittedModel: string;
  readonly useWebSearch: boolean;
  readonly directWebSearch: WebSearchResponse | null;
  readonly streamRequest: ChatCompletionRequest;
  readonly controller: AbortController;
  readonly activeFlushTimersRef: MutableStore<Record<string, number>>;
  readonly activeStreamRunIdsRef: MutableStore<Record<string, string>>;
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
  chatId,
  assistantMessageId,
  submittedModel,
  useWebSearch,
  directWebSearch,
  streamRequest,
  controller,
  activeFlushTimersRef,
  activeStreamRunIdsRef,
  onDraftUpdate,
}: RunAssistantStreamParams): Promise<Message> {
  const streamRunId = crypto.randomUUID();
  activeStreamRunIdsRef.current[chatId] = streamRunId;

  let accumulatedResponse = '';
  let accumulatedThinking = '';
  let inReasoning = false;
  let dirtyResponse = false;
  let dirtyThinking = false;

  const isActiveStreamRun = () =>
    activeStreamRunIdsRef.current[chatId] === streamRunId && !controller.signal.aborted;

  const webAnnotationsByUrl = buildAnnotationMap(directWebSearch);
  const collectWebAnnotations = (annotations: MessageAnnotation[]) => {
    for (const annotation of annotations) {
      webAnnotationsByUrl.set(annotation.url_citation.url, annotation);
    }
  };

  const flushNow = () => {
    delete activeFlushTimersRef.current[chatId];
    if (!isActiveStreamRun()) {
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

  const scheduleFlush = () => {
    if (activeFlushTimersRef.current[chatId] !== undefined) {
      return;
    }
    activeFlushTimersRef.current[chatId] = window.requestAnimationFrame(flushNow);
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

  await chatService.createChatCompletionStream(
    streamRequest,
    appendStreamChunk,
    () => {
      flushNow();
      if (isActiveStreamRun()) {
        resolveFinalText(stripReasoningMarkers(accumulatedResponse));
      }
    },
    (error: Error) => {
      console.error('Error en stream:', error);
      flushNow();
      rejectFinalText(error);
    },
    collectWebAnnotations,
    controller.signal
  );

  const finalAssistantText = await finalTextPromise;
  const finalVisibleText = stripReasoningMarkers(finalAssistantText);
  const webAnnotations = Array.from(webAnnotationsByUrl.values());
  const webSearchQueries = directWebSearch ? [directWebSearch.query] : undefined;

  return buildAssistantMessage({
    id: assistantMessageId,
    content: finalVisibleText,
    model: submittedModel,
    thinkingContent: accumulatedThinking || undefined,
    useWebSearch: useWebSearch || undefined,
    searchQueries: webSearchQueries,
    annotations: webAnnotations.length > 0 ? webAnnotations : undefined,
  });
}
