/**
 * Conversión entre el modelo de la app (`Chat`, `Message`, camelCase) y los
 * registros de IndexedDB (`ChatRecord`, `MessageRecord`, snake_case).
 *
 * Es el único sitio que conoce ambas formas: generación, migración e
 * importación pasan por aquí para que un campo nuevo no se pierda en alguno
 * de los caminos de persistencia.
 */
import { getDefaultModelId } from '../../models/catalog';
import { LOCAL_USER_ID, type ChatRecord, type MessageRecord } from '../../utils/db';
import type { Chat, Message } from '../../types';

type ChatRecordInput = Omit<ChatRecord, 'created_at'> & { readonly created_at?: string };

const toIsoDate = (timestamp: number): string | undefined =>
  Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp).toISOString() : undefined;

export const toChatRecord = (chat: Chat): ChatRecordInput => ({
  id: chat.id,
  title: chat.title,
  user_id: LOCAL_USER_ID,
  model: chat.model || getDefaultModelId(),
  customization_prompt: chat.customizationPrompt || undefined,
  is_pinned: chat.isPinned ?? false,
  created_at: toIsoDate(chat.createdAt),
});

export const toMessageRecord = (message: Message, chatId: string): MessageRecord => ({
  id: message.id,
  chat_id: chatId,
  role: message.role === 'user' ? 'user' : 'assistant',
  content: message.content.trim(),
  timestamp: message.timestamp || Date.now(),
  model: message.model,
  thinking_content: message.thinkingContent,
  use_web_search: message.useWebSearch,
  search_queries: message.searchQueries,
  annotations: message.annotations,
  attachments: message.attachments,
  user_id: LOCAL_USER_ID,
});

export const fromMessageRecord = (record: MessageRecord, fallbackModel: string): Message => ({
  id: record.id,
  role: record.role,
  content: record.content,
  timestamp: record.timestamp,
  model: record.model || fallbackModel,
  thinkingContent: record.thinking_content,
  useWebSearch: record.use_web_search,
  searchQueries: record.search_queries,
  annotations: record.annotations,
  attachments: record.attachments,
});

export const fromChatRecord = (record: ChatRecord, messages: readonly MessageRecord[]): Chat => {
  const model = record.model || getDefaultModelId();
  return {
    id: record.id,
    title: record.title,
    messages: messages.map((message) => fromMessageRecord(message, model)),
    createdAt: new Date(record.created_at).getTime(),
    model,
    isPersisted: true,
    isPinned: record.is_pinned ?? false,
    customizationPrompt: record.customization_prompt || undefined,
  };
};
