/**
 * Store de chats: única fuente de verdad para la lista de chats y el chat
 * activo.
 *
 * El chat activo se guarda como id (`currentChatId`) y se deriva de la lista,
 * así no existe una segunda copia que pueda desincronizarse. El estado vive
 * fuera de React (compatible con `useSyncExternalStore`), de modo que el
 * código asíncrono (streaming, persistencia) lee siempre el estado actual con
 * `getState()` sin refs ni closures obsoletos.
 */
import { useSyncExternalStore } from 'react';
import type { Chat } from '../types';

export interface ChatState {
  readonly chats: readonly Chat[];
  readonly currentChatId: string | null;
}

export interface ChatStore {
  readonly getState: () => ChatState;
  readonly subscribe: (listener: () => void) => () => void;
  readonly getChat: (chatId: string) => Chat | undefined;
  readonly getCurrentChat: () => Chat | null;
  /** Sustituye todos los chats (carga inicial); deselecciona si el activo ya no existe. */
  readonly replaceChats: (chats: readonly Chat[]) => void;
  readonly selectChat: (chatId: string | null) => void;
  /** Inserta el chat al principio o lo reemplaza si ya existe. */
  readonly upsertChat: (chat: Chat) => void;
  /** Aplica `update` al chat indicado; no hace nada si no existe. */
  readonly updateChat: (chatId: string, update: (chat: Chat) => Chat) => void;
  /**
   * Elimina un chat. Si era el activo, selecciona el más reciente que quede.
   * Devuelve el nuevo chat activo.
   */
  readonly removeChat: (chatId: string) => Chat | null;
  readonly clearChats: () => void;
}

const findChat = (chats: readonly Chat[], chatId: string | null): Chat | undefined =>
  chatId === null ? undefined : chats.find((chat) => chat.id === chatId);

export const createChatStore = (initialChats: readonly Chat[] = []): ChatStore => {
  let state: ChatState = { chats: initialChats, currentChatId: null };
  const listeners = new Set<() => void>();

  const setState = (next: ChatState) => {
    if (next.chats === state.chats && next.currentChatId === state.currentChatId) {
      return;
    }
    state = next;
    listeners.forEach((listener) => listener());
  };

  const getChat = (chatId: string) => findChat(state.chats, chatId);

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getChat,
    getCurrentChat: () => findChat(state.chats, state.currentChatId) ?? null,
    replaceChats: (chats) => {
      setState({
        chats,
        currentChatId: findChat(chats, state.currentChatId) ? state.currentChatId : null,
      });
    },
    selectChat: (chatId) => {
      setState({ ...state, currentChatId: chatId !== null && getChat(chatId) ? chatId : null });
    },
    upsertChat: (chat) => {
      const exists = state.chats.some((candidate) => candidate.id === chat.id);
      setState({
        ...state,
        chats: exists
          ? state.chats.map((candidate) => (candidate.id === chat.id ? chat : candidate))
          : [chat, ...state.chats],
      });
    },
    updateChat: (chatId, update) => {
      let changed = false;
      const chats = state.chats.map((chat) => {
        if (chat.id !== chatId) {
          return chat;
        }
        const updated = update(chat);
        changed = changed || updated !== chat;
        return updated;
      });
      if (changed) {
        setState({ ...state, chats });
      }
    },
    removeChat: (chatId) => {
      const chats = state.chats.filter((chat) => chat.id !== chatId);
      if (chats.length === state.chats.length) {
        return findChat(state.chats, state.currentChatId) ?? null;
      }
      let currentChatId = state.currentChatId;
      if (currentChatId === chatId) {
        currentChatId =
          chats.reduce<Chat | null>(
            (latest, chat) => (!latest || chat.createdAt > latest.createdAt ? chat : latest),
            null
          )?.id ?? null;
      }
      setState({ chats, currentChatId });
      return findChat(chats, currentChatId) ?? null;
    },
    clearChats: () => {
      setState({ chats: [], currentChatId: null });
    },
  };
};

export const useChatState = (store: ChatStore): ChatState =>
  useSyncExternalStore(store.subscribe, store.getState, store.getState);
