/**
 * Utilidades para importación de chats
 */

import { DEFAULT_MODEL_ID } from '../config/models';
import type { Chat, MessageAnnotation, MessageAttachment } from '../types';
import { replaceChatWithMessages } from './db';
import { isRecord, parseStoredChats } from './typeGuards';

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
    return directChats;
  }

  if (!isRecord(parsed)) {
    return [];
  }

  const wrappedChats = parseStoredChats(parsed.chats);
  if (wrappedChats.length > 0) {
    return wrappedChats;
  }

  const snapshotChats = parseChatsFromStorageSnapshot(parsed.storage);
  if (snapshotChats.length > 0) {
    return snapshotChats;
  }

  return parseChatsFromLocalDbState(parsed);
};

export const persistImportedChats = async (
  userId: string,
  importedChats: readonly Chat[]
): Promise<Set<string>> => {
  const persistedIds = await Promise.all(
    importedChats.map(async (chat) => {
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

        return chat.id;
      } catch (error) {
        console.error(`Error al persistir chat ${chat.id}:`, error);
        return null;
      }
    })
  );

  return new Set(persistedIds.filter((id): id is string => id !== null));
};

/**
 * Importa chats desde un archivo JSON
 */
export async function importChatsFromFile(
  params: ImportChatsParams
): Promise<ImportChatsResult | null> {
  return new Promise((resolve) => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';

      input.onchange = async (event) => {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }

        const reader = new FileReader();
        reader.onload = async (loadEvent) => {
          try {
            const result = loadEvent.target?.result;
            if (typeof result !== 'string') {
              throw new Error('Archivo inválido');
            }

            let parsed: unknown;
            try {
              parsed = JSON.parse(result);
            } catch {
              throw new Error('Formato de JSON inválido');
            }

            const importedChats = parseImportableChats(parsed);
            if (importedChats.length === 0) {
              throw new Error('No se encontraron chats válidos para importar');
            }

            // Persistir en la DB local cuando exista un perfil local activo.
            const persistedChatIds = params.userId
              ? await persistImportedChats(params.userId, importedChats)
              : new Set<string>();

            const normalizedChats: Chat[] = importedChats.map((chat) => ({
              ...chat,
              isPersisted: chat.isPersisted || persistedChatIds.has(chat.id),
              messages: chat.messages.map((message) => ({ ...message })),
            }));

            resolve({ chats: normalizedChats });
          } catch (error) {
            console.error('Error al procesar archivo:', error);
            const errorMessage = error instanceof Error ? error.message : 'Formato inválido';
            resolve({ chats: [], error: `Error al procesar el archivo: ${errorMessage}` });
          }
        };
        reader.readAsText(file);
      };

      input.click();
    } catch (error) {
      console.error('Error al importar:', error);
      resolve({ chats: [], error: 'Error al importar chats' });
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
