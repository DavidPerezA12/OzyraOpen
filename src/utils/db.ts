/**
 * Local database utilities.
 *
 * These functions preserve the public data API the app already uses, while
 * storing everything in browser localStorage. No remote database is required.
 */

import { queueLocalFolderSnapshotIfPermitted } from './localFolderSync';
import type { MessageAnnotation, MessageAttachment } from '../types';

export interface Profile {
  readonly id: string;
  readonly email: string;
  readonly name?: string;
  readonly knowledge?: string;
  readonly traits?: string;
  readonly additionalInfo?: string;
  readonly has_local_access?: boolean;
  readonly access_status?: string | null;
  readonly standard_message_usage?: number;
  readonly premium_message_usage?: number;
  readonly last_usage_reset_date?: string | null;
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

export type ModelTier = 'standard' | 'premium';

interface UsageStats {
  readonly standard_message_usage: number;
  readonly premium_message_usage: number;
}

interface LocalDbState {
  readonly profiles: Profile[];
  readonly chats: ChatRecord[];
  readonly messages: MessageRecord[];
}

const DB_KEY = 'ozyrachat:local-db:v1';

const emptyDb = (): LocalDbState => ({
  profiles: [],
  chats: [],
  messages: [],
});

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const preserveCorruptDbSnapshot = (storage: Storage, raw: string): void => {
  try {
    storage.setItem(`${DB_KEY}:corrupt:${Date.now()}`, raw);
  } catch {
    // Best-effort recovery only. If storage is unavailable/full, reset below.
  }
};

const readDb = (): LocalDbState => {
  const storage = getStorage();
  if (!storage) {
    return emptyDb();
  }
  const raw = storage.getItem(DB_KEY);
  if (!raw) {
    return emptyDb();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LocalDbState>;
    return {
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      chats: Array.isArray(parsed.chats) ? parsed.chats : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    };
  } catch (error) {
    console.error('[LocalDB] Failed to read local database', error);
    preserveCorruptDbSnapshot(storage, raw);
    storage.removeItem(DB_KEY);
    return emptyDb();
  }
};

const writeDb = (db: LocalDbState): void => {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  storage.setItem(DB_KEY, JSON.stringify(db));
  void queueLocalFolderSnapshotIfPermitted().catch((error) => {
    console.warn('[LocalDB] Failed to update local folder snapshot', error);
  });
};

let dbWriteQueue: Promise<unknown> = Promise.resolve();

const waitForPendingWrites = async (): Promise<void> => {
  try {
    await dbWriteQueue;
  } catch {
    // The caller that scheduled the write receives the real error. Readers
    // should still continue with the latest state available in storage.
  }
};

const readConsistentDb = async (): Promise<LocalDbState> => {
  await waitForPendingWrites();
  return readDb();
};

const mutateDb = async <T>(
  operation: (db: LocalDbState) => { db: LocalDbState; result: T }
): Promise<T> => {
  const run = dbWriteQueue.then(() => {
    const { db, result } = operation(readDb());
    writeDb(db);
    return result;
  });

  dbWriteQueue = run.catch(() => undefined);
  return run;
};

const validateRequired = (params: Record<string, unknown>, operation: string): void => {
  const missing = Object.entries(params).flatMap(([key, value]) =>
    value === null || value === undefined || value === '' ? [key] : []
  );

  if (missing.length > 0) {
    throw new Error(`Missing required parameters for ${operation}: ${missing.join(', ')}`);
  }
};

const todayIsoDate = (): string => new Date().toISOString().split('T')[0];

const normalizeProfile = (profile: Profile): Profile => ({
  ...profile,
  has_local_access: profile.has_local_access ?? false,
  access_status: profile.access_status ?? null,
  standard_message_usage: profile.standard_message_usage ?? 0,
  premium_message_usage: profile.premium_message_usage ?? 0,
  last_usage_reset_date: profile.last_usage_reset_date ?? todayIsoDate(),
});

const upsertProfileInState = (db: LocalDbState, profile: Profile): LocalDbState => {
  const normalized = normalizeProfile(profile);
  const exists = db.profiles.some((item) => item.id === normalized.id);
  return {
    ...db,
    profiles: exists
      ? db.profiles.map((item) =>
          item.id === normalized.id ? normalizeProfile({ ...item, ...profile }) : item
        )
      : [...db.profiles, normalized],
  };
};

export async function getProfile(userId: string): Promise<Profile | null> {
  validateRequired({ userId }, 'getProfile');
  const profile = (await readConsistentDb()).profiles.find((item) => item.id === userId);
  return profile ? normalizeProfile(profile) : null;
}

export async function upsertProfile(profile: Profile): Promise<Profile> {
  validateRequired({ id: profile.id }, 'upsertProfile');
  return mutateDb((db) => {
    const nextDb = upsertProfileInState(db, profile);
    const saved = nextDb.profiles.find((item) => item.id === profile.id);
    return { db: nextDb, result: normalizeProfile(saved ?? profile) };
  });
}

export async function getChats(userId: string): Promise<ChatRecord[]> {
  validateRequired({ userId }, 'getChats');
  return (await readConsistentDb()).chats
    .filter((chat) => chat.user_id === userId)
    .sort((a, b) => {
      const pinnedDelta = Number(b.is_pinned ?? false) - Number(a.is_pinned ?? false);
      if (pinnedDelta !== 0) {
        return pinnedDelta;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
}

export async function createChat(
  chat: Omit<ChatRecord, 'created_at'> & { readonly created_at?: string }
): Promise<ChatRecord> {
  validateRequired({ id: chat.id, title: chat.title, user_id: chat.user_id }, 'createChat');
  return mutateDb((db) => {
    const existing = db.chats.find((item) => item.id === chat.id);
    if (existing) {
      return { db, result: existing };
    }

    const record: ChatRecord = {
      ...chat,
      created_at: chat.created_at ?? new Date().toISOString(),
      is_pinned: chat.is_pinned ?? false,
    };
    return { db: { ...db, chats: [record, ...db.chats] }, result: record };
  });
}

export async function deleteChatRecord(chatId: string): Promise<void> {
  validateRequired({ chatId }, 'deleteChatRecord');
  await mutateDb((db) => ({
    db: {
      ...db,
      chats: db.chats.filter((chat) => chat.id !== chatId),
      messages: db.messages.filter((message) => message.chat_id !== chatId),
    },
    result: undefined,
  }));
}

export async function deleteAllChatsForUser(userId: string): Promise<void> {
  validateRequired({ userId }, 'deleteAllChatsForUser');
  await mutateDb((db) => {
    const chatIds = new Set<string>();
    for (const chat of db.chats) {
      if (chat.user_id === userId) {
        chatIds.add(chat.id);
      }
    }
    return {
      db: {
        ...db,
        chats: db.chats.filter((chat) => chat.user_id !== userId),
        messages: db.messages.filter((message) => !chatIds.has(message.chat_id)),
      },
      result: undefined,
    };
  });
}

export async function getMessages(chatId: string): Promise<MessageRecord[]> {
  validateRequired({ chatId }, 'getMessages');
  return (await readConsistentDb()).messages
    .filter((message) => message.chat_id === chatId)
    .sort((a, b) => a.timestamp - b.timestamp);
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

  return mutateDb((db) => {
    const existing = db.messages.find((item) => item.id === message.id);
    if (existing) {
      return { db, result: existing };
    }
    const record: MessageRecord = {
      ...message,
      search_queries: message.search_queries ? [...message.search_queries] : undefined,
      annotations: message.annotations?.map((annotation) => ({
        ...annotation,
        url_citation: { ...annotation.url_citation },
      })),
      attachments: message.attachments?.map((attachment) => ({ ...attachment })),
      is_complete: message.is_complete ?? true,
    };
    return { db: { ...db, messages: [...db.messages, record] }, result: record };
  });
}

export async function replaceChatWithMessages(
  chat: Omit<ChatRecord, 'created_at'> & { readonly created_at?: string },
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

  return mutateDb((db) => {
    const conflictingMessage = db.messages.find(
      (message) => message.chat_id !== chat.id && messageIds.has(message.id)
    );
    if (conflictingMessage) {
      throw new Error(
        `Imported message id already exists in another chat: ${conflictingMessage.id}`
      );
    }

    const existing = db.chats.find((item) => item.id === chat.id);
    const record: ChatRecord = {
      ...chat,
      created_at: chat.created_at ?? existing?.created_at ?? new Date().toISOString(),
      is_pinned: chat.is_pinned ?? false,
    };
    const importedMessages = messages.map((message) => ({
      ...message,
      search_queries: message.search_queries ? [...message.search_queries] : undefined,
      annotations: message.annotations?.map((annotation) => ({
        ...annotation,
        url_citation: { ...annotation.url_citation },
      })),
      attachments: message.attachments?.map((attachment) => ({ ...attachment })),
      is_complete: message.is_complete ?? true,
    }));

    return {
      db: {
        ...db,
        chats: [record, ...db.chats.filter((item) => item.id !== chat.id)],
        messages: [
          ...db.messages.filter((message) => message.chat_id !== chat.id),
          ...importedMessages,
        ],
      },
      result: record,
    };
  });
}

export async function updateMessageContent(
  messageId: string,
  content: string
): Promise<MessageRecord> {
  validateRequired({ messageId }, 'updateMessageContent');
  return mutateDb((db) => {
    const target = db.messages.find((message) => message.id === messageId);
    if (!target) {
      throw new Error('Message not found');
    }
    const updated = { ...target, content };
    return {
      db: {
        ...db,
        messages: db.messages.map((message) => (message.id === messageId ? updated : message)),
      },
      result: updated,
    };
  });
}

export async function deleteMessagesByIds(
  chatId: string,
  messageIds: readonly string[]
): Promise<void> {
  validateRequired({ chatId }, 'deleteMessagesByIds');
  if (messageIds.length === 0) {
    return;
  }

  const idsToDelete = new Set(messageIds);
  await mutateDb((db) => ({
    db: {
      ...db,
      messages: db.messages.filter(
        (message) => message.chat_id !== chatId || !idsToDelete.has(message.id)
      ),
    },
    result: undefined,
  }));
}

export async function incrementMessageUsage(
  userId: string,
  modelTier: ModelTier
): Promise<UsageStats | null> {
  return mutateDb((db) => {
    const profile = db.profiles.find((item) => item.id === userId);
    if (!profile) {
      return { db, result: null };
    }

    const today = todayIsoDate();
    const resetCounters = profile.last_usage_reset_date !== today;
    const standard =
      (resetCounters ? 0 : (profile.standard_message_usage ?? 0)) +
      (modelTier === 'standard' ? 1 : 0);
    const premium =
      (resetCounters ? 0 : (profile.premium_message_usage ?? 0)) +
      (modelTier === 'premium' ? 1 : 0);

    const updated = normalizeProfile({
      ...profile,
      standard_message_usage: standard,
      premium_message_usage: premium,
      last_usage_reset_date: today,
    });
    return {
      db: upsertProfileInState(db, updated),
      result: {
        standard_message_usage: standard,
        premium_message_usage: premium,
      },
    };
  });
}

export async function updateChatTitle(chatId: string, newTitle: string): Promise<ChatRecord> {
  validateRequired({ chatId, newTitle }, 'updateChatTitle');
  return mutateDb((db) => {
    const target = db.chats.find((chat) => chat.id === chatId);
    if (!target) {
      throw new Error('Chat not found');
    }
    const updated = { ...target, title: newTitle };
    return {
      db: { ...db, chats: db.chats.map((chat) => (chat.id === chatId ? updated : chat)) },
      result: updated,
    };
  });
}

export async function updateChatPinStatus(
  chatId: string,
  isPinned: boolean
): Promise<ChatRecord | null> {
  return mutateDb((db) => {
    const target = db.chats.find((chat) => chat.id === chatId);
    if (!target) {
      return { db, result: null };
    }
    const updated = { ...target, is_pinned: isPinned };
    return {
      db: { ...db, chats: db.chats.map((chat) => (chat.id === chatId ? updated : chat)) },
      result: updated,
    };
  });
}

export async function updateChatCustomizationPrompt(
  chatId: string,
  customizationPrompt: string | undefined | null
): Promise<ChatRecord> {
  return mutateDb((db) => {
    const target = db.chats.find((chat) => chat.id === chatId);
    if (!target) {
      throw new Error('Chat not found');
    }
    const updated = { ...target, customization_prompt: customizationPrompt ?? undefined };
    return {
      db: { ...db, chats: db.chats.map((chat) => (chat.id === chatId ? updated : chat)) },
      result: updated,
    };
  });
}
