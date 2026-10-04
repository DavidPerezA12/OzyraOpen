import type { Message } from '../../types';
import type { AssistantDraftUpdate } from './assistantStreamRunner';

const INTERRUPTED_GENERATION_MARKER = '_(Generación interrumpida por el usuario)_';

export const applyAssistantDraftUpdate = (
  message: Message,
  updates: AssistantDraftUpdate
): Message => ({
  ...message,
  content:
    updates.partialResponse !== undefined ? (updates.partialResponse ?? '') : message.content,
  thinkingContent:
    updates.thinkingProcessContent !== undefined
      ? updates.thinkingProcessContent || undefined
      : message.thinkingContent,
});

export const applyFinalAssistantMessage = (draft: Message, finalMessage: Message): Message => ({
  ...draft,
  content: finalMessage.content,
  thinkingContent: finalMessage.thinkingContent,
  useWebSearch: finalMessage.useWebSearch,
  searchQueries: finalMessage.searchQueries,
  annotations: finalMessage.annotations,
});

export const markAssistantMessageInterrupted = ({
  message,
  partialResponse,
  thinkingContent,
}: {
  readonly message: Message;
  readonly partialResponse?: string | null;
  readonly thinkingContent?: string | null;
}): Message => ({
  ...message,
  content: `${partialResponse || message.content || ''}\n\n${INTERRUPTED_GENERATION_MARKER}`,
  thinkingContent: thinkingContent || message.thinkingContent,
});
