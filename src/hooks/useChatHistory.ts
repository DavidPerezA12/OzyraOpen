import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CHAT_CONFIG } from '../config/constants';
import { t } from '../i18n';
import { getValidModelId } from '../models/catalog';
import type { ChatStore } from '../state/chatStore';
import type { Chat } from '../types';
import {
  LOCAL_USER_ID,
  deleteAllChatsForUser,
  deleteChatRecord,
  getProfile,
  updateChatPinStatus,
  updateChatTitle as updateChatTitleDb,
  upsertProfile,
} from '../utils/db';
import { loadChatsFromDatabase, migrateLocalChatsToDatabase } from '../utils/chatMigration';
import { parseStoredChats } from '../utils/typeGuards';
import { readLocalStorage, removeLocalStorage, writeLocalStorage } from '../utils/browserStorage';
import { readStoredPreferences } from '../utils/userPreferences';
import { logger } from '../utils/logger';

const LEGACY_CHATS_KEY = 'chats';

/**
 * Chats del formato antiguo (todo en una clave de localStorage). Si el JSON
 * está corrupto se archiva para diagnóstico en lugar de borrarlo.
 */
export const readLegacyLocalChats = (): Chat[] => {
  const savedChats = readLocalStorage(LEGACY_CHATS_KEY);
  if (!savedChats) {
    return [];
  }
  try {
    return parseStoredChats(JSON.parse(savedChats) as unknown).map((chat) => ({
      ...chat,
      isPinned: chat.isPinned ?? false,
      model: getValidModelId(chat.model),
    }));
  } catch (error) {
    logger.error('[History] Error parsing saved chats:', error);
    writeLocalStorage(`chats:corrupt:${Date.now()}`, savedChats);
    removeLocalStorage(LEGACY_CHATS_KEY);
    toast.error(t('corruptHistoryArchived'));
    return [];
  }
};

const ensureLocalProfile = async (): Promise<void> => {
  if (await getProfile(LOCAL_USER_ID)) {
    return;
  }
  const preferences = readStoredPreferences();
  await upsertProfile({
    id: LOCAL_USER_ID,
    email: '',
    name: preferences.name || 'Perfil local',
    knowledge: preferences.knowledge,
    traits: preferences.traits,
    additionalInfo: preferences.additionalInfo,
  });
};

/**
 * Carga el historial local en el store y expone las operaciones que
 * persisten cambios de chats (borrar, fijar, renombrar).
 *
 * Todas las operaciones leen el estado actual del store en el momento de
 * ejecutarse, así que son estables y nunca trabajan con datos obsoletos.
 */
export function useChatHistory(store: ChatStore) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        await ensureLocalProfile();

        const legacyChats = store.getState().chats;
        if (legacyChats.length > 0) {
          const migration = await migrateLocalChatsToDatabase(legacyChats);
          if (!migration.success) {
            // Se conservan los chats legacy en memoria y se reintenta en el próximo arranque.
            return;
          }
        }

        const loadedChats = await loadChatsFromDatabase();
        if (!cancelled && loadedChats.length > 0) {
          // Conservar chats creados mientras se cargaba el historial.
          const loadedIds = new Set(loadedChats.map((chat) => chat.id));
          const pendingChats = store.getState().chats.filter((chat) => !loadedIds.has(chat.id));
          store.replaceChats([...pendingChats, ...loadedChats]);
        }
      } catch (error) {
        logger.error('[History] Error loading local state:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [store]);

  const deleteChat = useCallback(
    async (chatId: string): Promise<Chat | null> => {
      const chat = store.getChat(chatId);
      if (!chat) {
        return store.getCurrentChat();
      }
      if (chat.isPersisted) {
        await deleteChatRecord(chatId);
      }
      return store.removeChat(chatId);
    },
    [store]
  );

  const deleteAllChats = useCallback(async () => {
    await deleteAllChatsForUser(LOCAL_USER_ID);
    removeLocalStorage(LEGACY_CHATS_KEY);
    store.clearChats();
  }, [store]);

  const togglePinChat = useCallback(
    async (chatId: string) => {
      const chat = store.getChat(chatId);
      if (!chat) {
        return;
      }

      const isPinned = !chat.isPinned;
      const pinnedCount = store.getState().chats.filter((candidate) => candidate.isPinned).length;
      if (isPinned && pinnedCount >= CHAT_CONFIG.MAX_PINNED_CHATS) {
        toast.error(t('maxPinnedChats', { max: CHAT_CONFIG.MAX_PINNED_CHATS }));
        return;
      }

      if (chat.isPersisted && !(await updateChatPinStatus(chatId, isPinned))) {
        throw new Error('Chat not found');
      }
      store.updateChat(chatId, (current) => ({ ...current, isPinned }));
    },
    [store]
  );

  const renameChat = useCallback(
    async (chatId: string, title: string) => {
      const chat = store.getChat(chatId);
      if (!chat) {
        return;
      }
      if (chat.isPersisted) {
        await updateChatTitleDb(chatId, title);
      }
      store.updateChat(chatId, (current) => ({ ...current, title }));
    },
    [store]
  );

  return { isLoading, deleteChat, deleteAllChats, togglePinChat, renameChat } as const;
}
