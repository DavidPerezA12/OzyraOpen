import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import toast from 'react-hot-toast';
import {
  DEFAULT_MODEL_ID,
  MODEL_CATALOG_UPDATED_EVENT,
  availableModels,
  getInitialEnabledModelIds,
  getValidModelId,
} from '../config/models';
import { CHAT_CONFIG } from '../config/constants';
import type { Chat } from '../types';
import {
  getProfile,
  upsertProfile,
  deleteAllChatsForUser,
  deleteChatRecord,
  updateChatPinStatus,
  updateChatTitle as updateChatTitleDb,
} from '../utils/db';
import { migrateLocalChatsToDatabase, loadChatsFromDatabase } from '../utils/chatMigration';
import { parseStoredChats } from '../utils/typeGuards';

const LOCAL_USER_ID = 'local-user';
const ENABLED_MODEL_IDS_KEY = 'ozyra:enabled-model-ids:v2';

const readLocalChats = (): Chat[] => {
  try {
    const savedChats = localStorage.getItem('chats');
    if (!savedChats) {
      return [];
    }
    return parseStoredChats(JSON.parse(savedChats) as unknown).map((chat) => ({
      ...chat,
      isPinned: chat.isPinned ?? false,
      model: getValidModelId(chat.model),
    }));
  } catch (error) {
    console.error('[Bootstrap] Error parsing saved chats:', error);
    localStorage.removeItem('chats');
    localStorage.removeItem('lastActiveChatId');
    return [];
  }
};

const getInitialSelectedModel = (): string => {
  const savedSelectedModel = localStorage.getItem('selectedModel');
  return savedSelectedModel ? getValidModelId(savedSelectedModel) : DEFAULT_MODEL_ID;
};

const getInitialEnabledModelIdsFromStorage = (): string[] => {
  const availableIds = new Set(availableModels.map((model) => model.id));
  const readIds = (key: string, maxItems?: number): string[] | null => {
    const saved = localStorage.getItem(key);
    if (saved === null) {
      return null;
    }
    const parsed = JSON.parse(saved) as unknown;
    if (!Array.isArray(parsed) || (maxItems !== undefined && parsed.length > maxItems)) {
      return null;
    }
    return parsed.filter((id): id is string => typeof id === 'string' && availableIds.has(id));
  };

  try {
    const currentIds = readIds(ENABLED_MODEL_IDS_KEY);
    if (currentIds !== null) {
      return currentIds;
    }
    const legacyIds = readIds('enabledModelIds', 40);
    return legacyIds && legacyIds.length > 0 ? legacyIds : getInitialEnabledModelIds();
  } catch (error) {
    console.error('[Bootstrap] Error parsing enabled models:', error);
    return getInitialEnabledModelIds();
  }
};

interface UseAppBootstrapParams {
  updateUsageFromProfile: (standard: number, premium: number) => void;
}

export interface UseAppBootstrapReturn {
  userId: string | null;
  isLocalProfileLoading: boolean;

  chats: Chat[];
  setChats: Dispatch<SetStateAction<Chat[]>>;
  currentChat: Chat | null;
  setCurrentChat: Dispatch<SetStateAction<Chat | null>>;

  selectedModel: string;
  setSelectedModel: (model: string) => void;

  enabledModelIds: string[];
  setEnabledModelIds: Dispatch<SetStateAction<string[]>>;

  deleteAllChats: () => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  togglePinChat: (chatId: string) => Promise<void>;
  updateChatTitle: (chatId: string, newTitle: string) => Promise<void>;
}

export function useAppBootstrap({
  updateUsageFromProfile,
}: UseAppBootstrapParams): UseAppBootstrapReturn {
  const userId: string | null = LOCAL_USER_ID;
  const [isLocalProfileLoading, setIsLocalProfileLoading] = useState<boolean>(true);

  const initialLocalChatsRef = useRef<Chat[] | undefined>(undefined);
  if (initialLocalChatsRef.current === undefined) {
    initialLocalChatsRef.current = readLocalChats();
  }
  const [chats, setChats] = useState<Chat[]>(initialLocalChatsRef.current);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);

  // Refs para evitar stale closures en callbacks async
  const chatsRef = useRef(chats);
  const currentChatRef = useRef(currentChat);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);
  useEffect(() => {
    currentChatRef.current = currentChat;
  }, [currentChat]);

  const [selectedModel, setSelectedModelState] = useState<string>(getInitialSelectedModel);
  const [enabledModelIds, setEnabledModelIdsState] = useState<string[]>(
    getInitialEnabledModelIdsFromStorage
  );
  const [, setModelCatalogVersion] = useState(0);

  // No auto-select de chats al iniciar: el estado inicial será "nuevo chat" (currentChat = null)

  // Helper: hydrate chats from localStorage
  const hydrateLocalChats = useCallback(() => {
    setChats(readLocalChats());
    setCurrentChat(null);
  }, []);

  // Optionally, caller can decide how to react to ?newChat=1; we only expose suppression via ref

  const setSelectedModel = useCallback((model: string) => {
    setSelectedModelState(model);
    localStorage.setItem('selectedModel', model);
  }, []);

  const setEnabledModelIds = useCallback<Dispatch<SetStateAction<string[]>>>((action) => {
    setEnabledModelIdsState((current) => {
      const next = typeof action === 'function' ? action(current) : action;
      localStorage.setItem(ENABLED_MODEL_IDS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const handleCatalogUpdated = () => {
      setModelCatalogVersion((version) => version + 1);
      setSelectedModelState((current) => {
        const next = getValidModelId(current);
        localStorage.setItem('selectedModel', next);
        return next;
      });
      setEnabledModelIds((current) => {
        if (current.length === 0) {
          return current;
        }
        const availableIds = new Set(availableModels.map((model) => model.id));
        const stillAvailable = current.filter((id) => availableIds.has(id));
        if (stillAvailable.length > 0) {
          return stillAvailable;
        }
        return getInitialEnabledModelIds();
      });
    };

    window.addEventListener(MODEL_CATALOG_UPDATED_EVENT, handleCatalogUpdated);
    return () => window.removeEventListener(MODEL_CATALOG_UPDATED_EVENT, handleCatalogUpdated);
  }, [setEnabledModelIds]);

  // Local profile/chats bootstrap
  useEffect(() => {
    const bootstrapLocalState = async () => {
      try {
        const existingProfile = await getProfile(LOCAL_USER_ID);
        if (!existingProfile) {
          await upsertProfile({
            id: LOCAL_USER_ID,
            email: '',
            name: localStorage.getItem('userName') || 'Perfil local',
            knowledge: localStorage.getItem('userKnowledge') || '',
            traits: localStorage.getItem('userTraits') || '',
            additionalInfo: localStorage.getItem('userAdditionalInfo') || '',
            has_local_access: true,
          });
          updateUsageFromProfile(0, 0);
        } else {
          updateUsageFromProfile(
            existingProfile.standard_message_usage ?? 0,
            existingProfile.premium_message_usage ?? 0
          );
        }

        const localChats = initialLocalChatsRef.current;
        if (localChats && localChats.length > 0) {
          const migration = await migrateLocalChatsToDatabase(LOCAL_USER_ID, localChats);
          if (!migration.success) {
            hydrateLocalChats();
            return;
          }
        }
        initialLocalChatsRef.current = [];

        const loadedChats = await loadChatsFromDatabase(LOCAL_USER_ID);
        if (loadedChats.length > 0) {
          setChats(loadedChats);
          setCurrentChat(null);
        } else {
          hydrateLocalChats();
        }
      } catch (error) {
        console.error('[Bootstrap] Error loading local state:', error);
        hydrateLocalChats();
      } finally {
        setIsLocalProfileLoading(false);
      }
    };

    void bootstrapLocalState();
  }, [hydrateLocalChats, updateUsageFromProfile]);

  const deleteAllChats = useCallback(async () => {
    try {
      await deleteAllChatsForUser(LOCAL_USER_ID);
      setChats([]);
      setCurrentChat(null);
      localStorage.removeItem('chats');
      localStorage.removeItem('lastActiveChatId');
    } catch (error) {
      console.error('[Bootstrap] Error deleting all chats:', error);
      throw error;
    }
  }, []);

  const deleteChat = useCallback(async (chatId: string) => {
    const chatToDelete = chatsRef.current.find((c) => c.id === chatId);
    if (!chatToDelete) {
      return;
    }
    const chatWasPersisted = chatToDelete.isPersisted ?? false;

    if (chatWasPersisted) {
      try {
        await deleteChatRecord(chatId);
      } catch (error) {
        console.error('[Bootstrap] Error deleting chat from local history:', error);
        throw error;
      }
    }

    setChats((prev) => prev.filter((c) => c.id !== chatId));
    if (currentChatRef.current?.id === chatId) {
      const remaining = chatsRef.current
        .filter((c) => c.id !== chatId)
        .sort((a, b) => b.createdAt - a.createdAt);
      setCurrentChat(remaining.length > 0 ? remaining[0] : null);
    }
  }, []);

  const togglePinChat = useCallback(async (chatId: string) => {
    const chat = chatsRef.current.find((c) => c.id === chatId);
    if (!chat) {
      return;
    }

    const newPinned = !chat.isPinned;

    const pinnedCount = chatsRef.current.filter((c) => c.isPinned).length;
    if (newPinned && pinnedCount >= CHAT_CONFIG.MAX_PINNED_CHATS) {
      toast.error(`Puedes fijar un máximo de ${CHAT_CONFIG.MAX_PINNED_CHATS} chats.`);
      return;
    }

    if (chat.isPersisted ?? false) {
      const persisted = await updateChatPinStatus(chatId, newPinned);
      if (!persisted) {
        throw new Error('Chat not found');
      }
    }

    setChats((prev) => {
      const updated = prev.map((c) => (c.id === chatId ? { ...c, isPinned: newPinned } : c));
      // Sort: pinned first, then by createdAt desc
      updated.sort((a, b) => {
        if (a.isPinned !== b.isPinned) {
          return a.isPinned ? -1 : 1;
        }
        return b.createdAt - a.createdAt;
      });
      return updated;
    });
  }, []);

  const updateChatTitle = useCallback(async (chatId: string, newTitle: string) => {
    const chat = chatsRef.current.find((candidate) => candidate.id === chatId);
    if (!chat) {
      return;
    }
    if (chat.isPersisted ?? false) {
      await updateChatTitleDb(chatId, newTitle);
    }
    setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, title: newTitle } : c)));
    if (currentChatRef.current?.id === chatId) {
      setCurrentChat({ ...currentChatRef.current, title: newTitle });
    }
  }, []);

  return {
    userId,
    isLocalProfileLoading,

    chats,
    setChats,
    currentChat,
    setCurrentChat,

    selectedModel,
    setSelectedModel,

    enabledModelIds,
    setEnabledModelIds,

    deleteAllChats,
    deleteChat,
    togglePinChat,
    updateChatTitle,
  } as const;
}
