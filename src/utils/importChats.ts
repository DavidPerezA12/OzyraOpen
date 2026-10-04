/**
 * Utilidades para importación de chats
 */

import { DEFAULT_MODEL_ID } from '../config/models';
import type { Chat, MessageAnnotation, MessageAttachment } from '../types';
import { replaceChatWithMessages } from './db';
import { isRecord, parseStoredChats } from './typeGuards';
import { isSafeLinkHref } from './safeUrl';
import { t } from '../i18n';
import { logger } from './logger';

const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;
const MAX_IMPORT_CHATS = 500;
const MAX_MESSAGES_PER_CHAT = 1000;
const MAX_CONTENT_CHARS = 200_000;
const MAX_TITLE_CHARS = 200;
const MAX_ATTACHMENTS_PER_MESSAGE = 4;
const ALLOWED_IMPORT_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

const sanitizeImportedChats = (chats: Chat[]): Chat[] =>
  chats.slice(0, MAX_IMPORT_CHATS).map((chat) => ({
    ...chat,
    title: typeof chat.title === 'string' ? chat.title.slice(0, MAX_TITLE_CHARS) : '',
    messages: chat.messages.slice(0, MAX_MESSAGES_PER_CHAT).map((message) => ({
      ...message,
      content:
        typeof message.content === 'string' ? message.content.slice(0, MAX_CONTENT_CHARS) : '',
      annotations: Array.isArray(message.annotations)
        ? (message.annotations.filter(
            (annotation) =>
              annotation?.type === 'url_citation' &&
              typeof annotation.url_citation?.url === 'string' &&
              typeof annotation.url_citation?.title === 'string' &&
              isSafeLinkHref(annotation.url_citation.url)
          ) as MessageAnnotation[])
        : undefined,
      attachments: Array.isArray(message.attachments)
        ? (message.attachments
            .filter(
              (attachment): attachment is MessageAttachment =>
                !!attachment &&
                attachment.type === 'image' &&
                typeof attachment.url === 'string' &&
                typeof attachment.contentType === 'string' &&
                ALLOWED_IMPORT_IMAGE_TYPES.has(attachment.contentType) &&
                (typeof attachment.data !== 'string' || attachment.data.length <= 7_000_000)
            )
            .slice(0, MAX_ATTACHMENTS_PER_MESSAGE) as MessageAttachment[])
        : undefined,
    })),
  }));

interface ImportChatsParams {
  userId: string | null;
}

interface ImportChatsResult {
  chats: Chat[];
  error?: string;
}

const LOCAL_DB_STORAGE_KEY = 'ozyrachat:local-db:v1';

type DbChatRecord = {
  readonly id: string;
  readonly title: string;
  readonly created_at: string;
  readonly user_id?: string;
  readonly model?: string;
  readonly customization_prompt?: string;
  readonly is_pinned?: boolean;
};

type DbMessageRecord = {
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
};

const parseJsonValue = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

const parseTimestamp = (value: unknown, fallback = Date.now()): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
};

const isDbChatRecord = (value: unknown): value is DbChatRecord => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.created_at === 'string'
  );
};

const isDbMessageRecord = (value: unknown): value is DbMessageRecord => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.chat_id === 'string' &&
    (value.role === 'user' || value.role === 'assistant') &&
    typeof value.content === 'string' &&
    typeof value.timestamp === 'number'
  );
};

const parseChatsFromLocalDbState = (raw: unknown): Chat[] => {
  if (!isRecord(raw) || !Array.isArray(raw.chats) || !Array.isArray(raw.messages)) {
    return [];
  }

  const chatRecords = raw.chats.filter(isDbChatRecord);
  const messageRecords = raw.messages.filter(isDbMessageRecord);
  const messagesByChatId = new Map<string, DbMessageRecord[]>();

  for (const message of messageRecords) {
    const chatMessages = messagesByChatId.get(message.chat_id);
    if (chatMessages) {
      chatMessages.push(message);
    } else {
      messagesByChatId.set(message.chat_id, [message]);
    }
  }

  return chatRecords.map((chat) => ({
    id: chat.id,
    title: chat.title,
    createdAt: parseTimestamp(chat.created_at),
    model: chat.model || DEFAULT_MODEL_ID,
    customizationPrompt: chat.customization_prompt,
    isPinned: chat.is_pinned ?? false,
    isPersisted: true,
    messages: (messagesByChatId.get(chat.id) ?? [])
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
        model: message.model || chat.model || DEFAULT_MODEL_ID,
        thinkingContent: message.thinking_content,
        useWebSearch: message.use_web_search,
        searchQueries: message.search_queries,
        annotations: message.annotations,
        attachments: message.attachments,
      })),
  }));
};

const parseChatsFromStorageSnapshot = (storage: unknown): Chat[] => {
  if (!isRecord(storage)) {
    return [];
  }

  const directChats = parseStoredChats(parseJsonValue(storage.chats));
  if (directChats.length > 0) {
    return directChats;
  }

  const legacyLocalChats = parseStoredChats(parseJsonValue(storage.ozyra_local_chats));
  if (legacyLocalChats.length > 0) {
    return legacyLocalChats;
  }

  return parseChatsFromLocalDbState(parseJsonValue(storage[LOCAL_DB_STORAGE_KEY]));
};

export const parseImportableChats = (parsed: unknown): Chat[] => {
  const directChats = parseStoredChats(Array.isArray(parsed) ? parsed : [parsed]);
  if (directChats.length > 0) {
    return sanitizeImportedChats(directChats);
  }

  if (!isRecord(parsed)) {
    return [];
  }

  const wrappedChats = parseStoredChats(parsed.chats);
  if (wrappedChats.length > 0) {
    return sanitizeImportedChats(wrappedChats);
  }

  const snapshotChats = parseChatsFromStorageSnapshot(parsed.storage);
  if (snapshotChats.length > 0) {
    return sanitizeImportedChats(snapshotChats);
  }

  return sanitizeImportedChats(parseChatsFromLocalDbState(parsed));
};

export interface PersistImportedChatsResult {
  readonly persistedIds: Set<string>;
  readonly failed: string[];
}

/** Concurrencia acotada para no saturar IndexedDB con cientos de tx. */
const IMPORT_PERSIST_CONCURRENCY = 5;

export const persistImportedChats = async (
  userId: string,
  importedChats: readonly Chat[]
): Promise<PersistImportedChatsResult> => {
  const persistedIds = new Set<string>();
  const failed: string[] = [];
  let nextIndex = 0;

  const persistOne = async (chat: Chat): Promise<void> => {
    try {
      await replaceChatWithMessages(
        {
          id: chat.id,
          title: chat.title,
          created_at: new Date(chat.createdAt).toISOString(),
          user_id: userId,
          model: chat.model || DEFAULT_MODEL_ID,
          customization_prompt: chat.customizationPrompt,
          is_pinned: chat.isPinned || false,
        },
        chat.messages.map((message) => {
          const normalizedRole =
            message.role === 'assistant' || message.role === 'user' ? message.role : 'assistant';

          return {
            id: message.id,
            chat_id: chat.id,
            role: normalizedRole,
            content: message.content,
            timestamp: message.timestamp || Date.now(),
            model: message.model,
            thinking_content: message.thinkingContent,
            use_web_search: message.useWebSearch,
            search_queries: message.searchQueries,
            annotations: message.annotations,
            attachments: message.attachments,
            user_id: userId,
          };
        })
      );

      persistedIds.add(chat.id);
    } catch (error) {
      logger.error(`Error al persistir chat ${chat.id}:`, error);
      failed.push(chat.id);
    }
  };

  const workers = Array.from(
    { length: Math.min(IMPORT_PERSIST_CONCURRENCY, importedChats.length) },
    async () => {
      while (nextIndex < importedChats.length) {
        const chat = importedChats[nextIndex];
        nextIndex += 1;
        if (chat) {
          await persistOne(chat);
        }
      }
    }
  );
  await Promise.all(workers);

  return { persistedIds, failed };
};

/**
 * Importa chats desde un archivo JSON
 */
export async function importChatsFromFile(
  params: ImportChatsParams
): Promise<ImportChatsResult | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    // Adjuntar al DOM: algunos navegadores ignoran click() en inputs sueltos.
    input.style.display = 'none';
    document.body.appendChild(input);

    const cleanup = () => {
      try {
        input.remove();
      } catch {
        // Best-effort: el input ya puede no estar en el DOM.
      }
    };

    const fail = (errorKey: Parameters<typeof t>[0], message?: string) => {
      cleanup();
      resolve({
        chats: [],
        error: message ?? t(errorKey),
      });
    };

    try {
      input.onchange = async (event) => {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) {
          cleanup();
          resolve(null);
          return;
        }

        if (file.size === 0) {
          fail('importInvalidFile');
          return;
        }

        if (file.size > MAX_IMPORT_FILE_BYTES) {
          fail('importFileTooLarge');
          return;
        }

        const reader = new FileReader();
        reader.onerror = () => {
          logger.error('Error al leer archivo:', reader.error);
          fail('importInvalidFile');
        };
        reader.onabort = () => {
          fail('importInvalidFile');
        };
        reader.onload = async (loadEvent) => {
          try {
            const result = loadEvent.target?.result;
            if (typeof result !== 'string') {
              throw new Error(t('importInvalidFile'));
            }

            let parsed: unknown;
            try {
              parsed = JSON.parse(result);
            } catch {
              throw new Error(t('importInvalidJson'));
            }

            const importedChats = parseImportableChats(parsed);
            if (importedChats.length === 0) {
              throw new Error(t('importNoValidChats'));
            }

            // Persistir en la DB local cuando exista un perfil local activo.
            const persisted = params.userId
              ? await persistImportedChats(params.userId, importedChats)
              : { persistedIds: new Set<string>(), failed: [] as string[] };

            const normalizedChats: Chat[] = importedChats.map((chat) => ({
              ...chat,
              isPersisted: chat.isPersisted || persisted.persistedIds.has(chat.id),
              messages: chat.messages.map((message) => ({ ...message })),
            }));

            if (persisted.failed.length > 0) {
              logger.warn(`[Import] ${persisted.failed.length} chats no se pudieron persistir:`, {
                detail: persisted.failed,
              });
            }

            cleanup();
            resolve({ chats: normalizedChats });
          } catch (error) {
            logger.error('Error al procesar archivo:', error);
            const errorMessage = error instanceof Error ? error.message : t('importInvalidFormat');
            cleanup();
            resolve({ chats: [], error: t('importProcessError', { message: errorMessage }) });
          }
        };
        reader.readAsText(file);
      };

      input.oncancel = () => {
        cleanup();
        resolve(null);
      };

      input.click();
    } catch (error) {
      logger.error('Error al importar:', error);
      cleanup();
      resolve({ chats: [], error: t('importGenericError') });
    }
  });
}

/**
 * Merge imported chats with existing chats
 */
export function mergeImportedChats(existingChats: Chat[], importedChats: Chat[]): Chat[] {
  const existingChatMap = new Map(existingChats.map((c) => [c.id, c]));

  for (const importedChat of importedChats) {
    const existingChat = existingChatMap.get(importedChat.id);
    const isPersisted = (existingChat?.isPersisted ?? false) || importedChat.isPersisted;

    existingChatMap.set(importedChat.id, {
      ...importedChat,
      isPersisted,
    });
  }

  return Array.from(existingChatMap.values()).sort((a, b) => b.createdAt - a.createdAt);
}
