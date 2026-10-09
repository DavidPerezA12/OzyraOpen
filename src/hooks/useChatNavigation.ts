import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { ChatStore } from '../state/chatStore';

const replaceUrlParams = (update: (params: URLSearchParams) => void): void => {
  try {
    const url = new URL(window.location.href);
    update(url.searchParams);
    window.history.replaceState({}, '', url.toString());
  } catch {
    // La navegación no debe depender de que la URL se pueda reescribir.
  }
};

interface UseChatNavigationParams {
  readonly store: ChatStore;
  /** Se invoca al empezar un chat nuevo (limpiar composer, cerrar menús…) */
  readonly onNewChat: () => void;
  readonly textareaRef: RefObject<HTMLTextAreaElement>;
  /** Hay chats cargados: permite resolver `?chat=<id>` cuando llega el historial */
  readonly chatCount: number;
}

/**
 * Selección de chats sincronizada con la URL (`?chat=<id>` para enlazar un
 * chat, `?newChat=1` para abrir la app en un chat nuevo).
 */
export function useChatNavigation({
  store,
  onNewChat,
  textareaRef,
  chatCount,
}: UseChatNavigationParams) {
  const suppressUrlSelectionRef = useRef(false);

  const selectChat = useCallback(
    (chatId: string) => {
      suppressUrlSelectionRef.current = true;
      store.selectChat(chatId);
      replaceUrlParams((params) => {
        params.set('chat', chatId);
        params.delete('newChat');
      });
    },
    [store]
  );

  const startNewChat = useCallback(() => {
    suppressUrlSelectionRef.current = true;
    store.selectChat(null);
    onNewChat();
    replaceUrlParams((params) => {
      params.delete('chat');
      params.delete('newChat');
    });
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }, [onNewChat, store, textareaRef]);

  // `?newChat=1` es una instrucción de arranque: `startNewChat` borra el
  // parámetro, así que solo surte efecto una vez.
  useEffect(() => {
    try {
      if (new URL(window.location.href).searchParams.get('newChat') === '1') {
        startNewChat();
      }
    } catch {
      // URL malformada: se sigue con el arranque normal.
    }
  }, [startNewChat]);

  // `?chat=<id>` se resuelve en cuanto ese chat existe (el historial carga async).
  useEffect(() => {
    if (suppressUrlSelectionRef.current || store.getState().currentChatId) {
      return;
    }
    try {
      const chatId = new URL(window.location.href).searchParams.get('chat');
      if (chatId && store.getChat(chatId)) {
        suppressUrlSelectionRef.current = true;
        store.selectChat(chatId);
      }
    } catch {
      // URL malformada: la selección continúa desde el estado en memoria.
    }
  }, [chatCount, store]);

  return { selectChat, startNewChat } as const;
}
