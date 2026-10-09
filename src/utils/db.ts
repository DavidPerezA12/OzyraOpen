/**
 * Local database utilities.
 *
 * These functions preserve the public data API the app already uses, while
 * storing everything in IndexedDB (separate object stores for profiles,
 * chats and messages). No remote database is required. Data stored by the
 * previous localStorage implementation is migrated on first open (see
 * `localDbStore.ts`).
 */

import { queueLocalFolderSnapshotIfPermitted } from './localFolderSync';
import type { MessageAnnotation, MessageAttachment } from '../types';
import {
  CHATS_STORE,
  MESSAGES_BY_CHAT_INDEX,
  MESSAGES_STORE,
  PROFILES_STORE,
  getLocalDbConnection,
  requestToPromise,
  runTransaction,
} from './localDbStore';
import { logger } from './logger';

/** Único perfil de la app: todo es local a este navegador. */
export const LOCAL_USER_ID = 'local-user';

export interface Profile {
  readonly id: string;
  readonly email: string;
  readonly name?: string;
  readonly knowledge?: string;
  readonly traits?: string;
  readonly additionalInfo?: string;
}

export interface ChatRecord {
  readonly id: string;
  readonly title: string;
  readonly created_at: string;
  readonly user_id: string;
  readonly model?: string;
  readonly customization_prompt?: string;
  readonly is_pinned?: boolean;
}

export interface MessageRecord {
  readonly id: string;
  readonly chat_id: string;
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly timestamp: number;
  readonly model?: string;
  readonly thinking_content?: string;
  readonly use_web_search?: boolean;
  readonly search_queries?: readonly string[];
  readonly annotations?: readonly MessageAnnotation[];
  readonly attachments?: readonly MessageAttachment[];
  readonly is_complete?: boolean;
  readonly user_id: string;
}

const queueSnapshotAfterWrite = (): void => {
  void queueLocalFolderSnapshotIfPermitted().catch((error) => {
    logger.warn('[LocalDB] Failed to update local folder snapshot', { detail: error });
  });
};

/**
 * Runs a read-only transaction. When IndexedDB is unavailable (SSR, tests
 * without a fake, restricted contexts) the `fallback` result is returned,
 * mirroring how the previous implementation behaved without localStorage.
 */
const readTransaction = async <T>(
  storeNames: string | string[],
  fallback: () => T,
  operation: (transaction: IDBTransaction) => Promise<T>
): Promise<T> => {
  const db = await getLocalDbConnection();
  if (!db) {
    return fallback();
  }
  return runTransaction(db, storeNames, 'readonly', operation);
};

/**
 * Error lanzado cuando IndexedDB no está disponible y se intenta escribir.
 *
 * Antes las escrituras devolvían un "éxito" falso (fallback en memoria) que se
 * perdía silenciosamente. Ahora fallan de forma explícita para que los
 * llamadores muestren el error en lugar de perder datos.
 */
export class DbUnavailableError extends Error {
  constructor(operation = 'database operation') {
    super(`Local database unavailable during ${operation}`);
    this.name = 'DbUnavailableError';
  }
}

/**
 * Runs a read-write transaction and queues a local folder snapshot after the
 * transaction commits, like the previous implementation did on every write.
 *
 * Unlike reads, writes never fall back: if the database is unavailable an
 * explicit {@link DbUnavailableError} is thrown so callers surface the
 * failure instead of silently discarding the write.
 */
const writeTransaction = async <T>(
  storeNames: string | string[],
  operation: (transaction: IDBTransaction) => Promise<T>,
  operationName = 'write'
): Promise<T> => {
  const db = await getLocalDbConnection();
  if (!db) {
    throw new DbUnavailableError(operationName);
  }
  const result = await runTransaction(db, storeNames, 'readwrite', operation);
  queueSnapshotAfterWrite();
  return result;
};

const getRecord = <T>(store: IDBObjectStore, key: string): Promise<T | undefined> =>
  requestToPromise(store.get(key) as IDBRequest<T | undefined>);

const validateRequired = (params: Record<string, unknown>, operation: string): void => {
  const missing = Object.entries(params).flatMap(([key, value]) =>
    value === null || value === undefined || value === '' ? [key] : []
  );

  if (missing.length > 0) {
    throw new Error(`Missing required parameters for ${operation}: ${missing.join(', ')}`);
  }
};

type ChatInput = Omit<ChatRecord, 'created_at'> & { readonly created_at?: string };

const buildChatRecord = (chat: ChatInput, existing?: ChatRecord): ChatRecord => ({
  ...chat,
  created_at: chat.created_at ?? existing?.created_at ?? new Date().toISOString(),
  is_pinned: chat.is_pinned ?? false,
});

const buildMessageRecord = (message: MessageRecord): MessageRecord => ({
  ...message,
  search_queries: message.search_queries ? [...message.search_queries] : undefined,
  annotations: message.annotations?.map((annotation) => ({
    ...annotation,
    url_citation: { ...annotation.url_citation },
  })),
  attachments: message.attachments?.map((attachment) => ({ ...attachment })),
  is_complete: message.is_complete ?? true,
});

const deleteMessagesForChat = async (
  transaction: IDBTransaction,
  chatId: string
): Promise<void> => {
  const store = transaction.objectStore(MESSAGES_STORE);
  const keys = await requestToPromise(store.index(MESSAGES_BY_CHAT_INDEX).getAllKeys(chatId));
  await Promise.all(keys.map((key) => requestToPromise(store.delete(key))));
};

export async function getProfile(userId: string): Promise<Profile | null> {
  validateRequired({ userId }, 'getProfile');
  return readTransaction<Profile | null>(
    PROFILES_STORE,
    () => null,
    async (transaction) => {
      const profile = await getRecord<Profile>(transaction.objectStore(PROFILES_STORE), userId);
      return profile ?? null;
    }
  );
}

export async function upsertProfile(profile: Profile): Promise<Profile> {
  validateRequired({ id: profile.id }, 'upsertProfile');
  return writeTransaction<Profile>(
    PROFILES_STORE,
    async (transaction) => {
      const store = transaction.objectStore(PROFILES_STORE);
      const existing = await getRecord<Profile>(store, profile.id);
      const saved = existing ? { ...existing, ...profile } : profile;
      await requestToPromise(store.put(saved));
      return saved;
    },
    'upsertProfile'
  );
}

export async function getChats(userId: string): Promise<ChatRecord[]> {
  validateRequired({ userId }, 'getChats');
  return readTransaction<ChatRecord[]>(
    CHATS_STORE,
    () => [],
    async (transaction) => {
      const chats = await requestToPromise(
        transaction.objectStore(CHATS_STORE).getAll() as IDBRequest<ChatRecord[]>
      );
      return chats
        .filter((chat) => chat.user_id === userId)
        .sort((a, b) => {
          const pinnedDelta = Number(b.is_pinned ?? false) - Number(a.is_pinned ?? false);
          if (pinnedDelta !== 0) {
            return pinnedDelta;
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    }
  );
}

export async function createChat(chat: ChatInput): Promise<ChatRecord> {
  validateRequired({ id: chat.id, title: chat.title, user_id: chat.user_id }, 'createChat');
  return writeTransaction<ChatRecord>(
    CHATS_STORE,
    async (transaction) => {
      const store = transaction.objectStore(CHATS_STORE);
      const existing = await getRecord<ChatRecord>(store, chat.id);
      if (existing) {
        return existing;
      }
      const record = buildChatRecord(chat);
      await requestToPromise(store.add(record));
      return record;
    },
    'createChat'
  );
}

export async function deleteChatRecord(chatId: string): Promise<void> {
  validateRequired({ chatId }, 'deleteChatRecord');
  await writeTransaction<void>(
    [CHATS_STORE, MESSAGES_STORE],
    async (transaction) => {
      await Promise.all([
        requestToPromise(transaction.objectStore(CHATS_STORE).delete(chatId)),
        deleteMessagesForChat(transaction, chatId),
      ]);
    },
    'deleteChatRecord'
  );
}

export async function deleteAllChatsForUser(userId: string): Promise<void> {
  validateRequired({ userId }, 'deleteAllChatsForUser');
  await writeTransaction<void>(
    [CHATS_STORE, MESSAGES_STORE],
    async (transaction) => {
      const chatsStore = transaction.objectStore(CHATS_STORE);
      const chats = await requestToPromise(chatsStore.getAll() as IDBRequest<ChatRecord[]>);
      const ownedChats = chats.filter((chat) => chat.user_id === userId);
      await Promise.all(
        ownedChats.flatMap((chat) => [
          requestToPromise(chatsStore.delete(chat.id)),
          deleteMessagesForChat(transaction, chat.id),
        ])
      );
    },
    'deleteAllChatsForUser'
  );
}

export async function getMessages(chatId: string): Promise<MessageRecord[]> {
  validateRequired({ chatId }, 'getMessages');
  return readTransaction<MessageRecord[]>(
    MESSAGES_STORE,
    () => [],
    async (transaction) => {
      const messages = await requestToPromise(
        transaction
          .objectStore(MESSAGES_STORE)
          .index(MESSAGES_BY_CHAT_INDEX)
          .getAll(chatId) as IDBRequest<MessageRecord[]>
      );
      return messages.sort((a, b) => a.timestamp - b.timestamp);
    }
  );
}

export async function createMessage(message: MessageRecord): Promise<MessageRecord> {
  validateRequired(
    {
      id: message.id,
      chat_id: message.chat_id,
      user_id: message.user_id,
      role: message.role,
      timestamp: message.timestamp,
    },
    'createMessage'
  );

  if (typeof message.content !== 'string') {
    throw new Error('Missing required parameters for createMessage: content');
  }

  if (message.content.trim() === '' && !message.attachments?.length) {
    throw new Error('Message content or attachments are required');
  }

  return writeTransaction<MessageRecord>(
    MESSAGES_STORE,
    async (transaction) => {
      const store = transaction.objectStore(MESSAGES_STORE);
      const existing = await getRecord<MessageRecord>(store, message.id);
      if (existing) {
        return existing;
      }
      const record = buildMessageRecord(message);
      await requestToPromise(store.add(record));
      return record;
    },
    'createMessage'
  );
}

export async function replaceChatWithMessages(
  chat: ChatInput,
  messages: readonly MessageRecord[]
): Promise<ChatRecord> {
  validateRequired(
    { id: chat.id, title: chat.title, user_id: chat.user_id },
    'replaceChatWithMessages'
  );

  const messageIds = new Set<string>();
  for (const message of messages) {
    validateRequired(
      {
        id: message.id,
        chat_id: message.chat_id,
        user_id: message.user_id,
        role: message.role,
        timestamp: message.timestamp,
      },
      'replaceChatWithMessages'
    );
    if (message.chat_id !== chat.id) {
      throw new Error('Imported message does not belong to the imported chat');
    }
    if (message.content.trim() === '' && !message.attachments?.length) {
      throw new Error('Message content or attachments are required');
    }
    if (messageIds.has(message.id)) {
      throw new Error(`Duplicate imported message id: ${message.id}`);
    }
    messageIds.add(message.id);
  }

  return writeTransaction<ChatRecord>(
    [CHATS_STORE, MESSAGES_STORE],
    async (transaction) => {
      const chatsStore = transaction.objectStore(CHATS_STORE);
      const messagesStore = transaction.objectStore(MESSAGES_STORE);

      const storedMessages = await Promise.all(
        messages.map((message) => getRecord<MessageRecord>(messagesStore, message.id))
      );
      const conflictingMessage = storedMessages.find(
        (stored) => stored !== undefined && stored.chat_id !== chat.id
      );
      if (conflictingMessage) {
        throw new Error(
          `Imported message id already exists in another chat: ${conflictingMessage.id}`
        );
      }

      const existing = await getRecord<ChatRecord>(chatsStore, chat.id);
      const record = buildChatRecord(chat, existing);
      await requestToPromise(chatsStore.put(record));
      await deleteMessagesForChat(transaction, chat.id);
      await Promise.all(
        messages.map((message) => requestToPromise(messagesStore.put(buildMessageRecord(message))))
      );
      return record;
    },
    'replaceChatWithMessages'
  );
}

export async function updateMessageContent(
  messageId: string,
  content: string
): Promise<MessageRecord> {
  validateRequired({ messageId }, 'updateMessageContent');
  return writeTransaction<MessageRecord>(
    MESSAGES_STORE,
    async (transaction) => {
      const store = transaction.objectStore(MESSAGES_STORE);
      const target = await getRecord<MessageRecord>(store, messageId);
      if (!target) {
        throw new Error('Message not found');
      }
      const updated = { ...target, content };
      await requestToPromise(store.put(updated));
      return updated;
    },
    'updateMessageContent'
  );
}

export async function deleteMessagesByIds(
  chatId: string,
  messageIds: readonly string[]
): Promise<void> {
  validateRequired({ chatId }, 'deleteMessagesByIds');
  if (messageIds.length === 0) {
    return;
  }

  await writeTransaction<void>(
    MESSAGES_STORE,
    async (transaction) => {
      const store = transaction.objectStore(MESSAGES_STORE);
      await Promise.all(
        messageIds.map(async (messageId) => {
          const existing = await getRecord<MessageRecord>(store, messageId);
          if (existing && existing.chat_id === chatId) {
            await requestToPromise(store.delete(messageId));
          }
        })
      );
    },
    'deleteMessagesByIds'
  );
}

export async function updateChatTitle(chatId: string, newTitle: string): Promise<ChatRecord> {
  validateRequired({ chatId, newTitle }, 'updateChatTitle');
  return writeTransaction<ChatRecord>(
    CHATS_STORE,
    async (transaction) => {
      const store = transaction.objectStore(CHATS_STORE);
      const target = await getRecord<ChatRecord>(store, chatId);
      if (!target) {
        throw new Error('Chat not found');
      }
      const updated = { ...target, title: newTitle };
      await requestToPromise(store.put(updated));
      return updated;
    },
    'updateChatTitle'
  );
}

export async function updateChatPinStatus(
  chatId: string,
  isPinned: boolean
): Promise<ChatRecord | null> {
  return writeTransaction<ChatRecord | null>(
    CHATS_STORE,
    async (transaction) => {
      const store = transaction.objectStore(CHATS_STORE);
      const target = await getRecord<ChatRecord>(store, chatId);
      if (!target) {
        return null;
      }
      const updated = { ...target, is_pinned: isPinned };
      await requestToPromise(store.put(updated));
      return updated;
    },
    'updateChatPinStatus'
  );
}

export async function updateChatCustomizationPrompt(
  chatId: string,
  customizationPrompt: string | undefined | null
): Promise<ChatRecord> {
  return writeTransaction<ChatRecord>(
    CHATS_STORE,
    async (transaction) => {
      const store = transaction.objectStore(CHATS_STORE);
      const target = await getRecord<ChatRecord>(store, chatId);
      if (!target) {
        throw new Error('Chat not found');
      }
      const updated = { ...target, customization_prompt: customizationPrompt ?? undefined };
      await requestToPromise(store.put(updated));
      return updated;
    },
    'updateChatCustomizationPrompt'
  );
}
