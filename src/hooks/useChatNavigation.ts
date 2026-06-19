import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import type { Chat, UploadedImage } from '../types';

interface UseChatNavigationParams {
  readonly chats: Chat[];
  readonly currentChat: Chat | null;
  readonly setCurrentChat: Dispatch<SetStateAction<Chat | null>>;
  readonly setInputValue: Dispatch<SetStateAction<string>>;
  readonly setUploadedImages: Dispatch<SetStateAction<UploadedImage[]>>;
  readonly setIsModelDropdownOpen: Dispatch<SetStateAction<boolean>>;
  readonly textareaRef: RefObject<HTMLTextAreaElement>;
}

export function useChatNavigation({
  chats,
  currentChat,
  setCurrentChat,
  setInputValue,
  setUploadedImages,
  setIsModelDropdownOpen,
  textareaRef,
}: UseChatNavigationParams) {
  const suppressAutoSelectRef = useRef(false);

  const startNewChat = useCallback(() => {
    suppressAutoSelectRef.current = true;
    setCurrentChat(null);
    setInputValue('');
    setUploadedImages([]);
    setIsModelDropdownOpen(false);

    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('chat');
      url.searchParams.delete('newChat');
      window.history.replaceState({}, '', url.toString());
    } catch {
      // Starting a new chat should not depend on URL cleanup succeeding.
    }

    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  }, [setCurrentChat, setInputValue, setIsModelDropdownOpen, setUploadedImages, textareaRef]);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('newChat') === '1') {
        suppressAutoSelectRef.current = true;
        startNewChat();
        url.searchParams.delete('newChat');
        window.history.replaceState({}, '', url.toString());
      }
    } catch {
      // Ignore malformed URLs and keep the default startup flow.
    }
  }, [startNewChat]);

  useEffect(() => {
    if (suppressAutoSelectRef.current || currentChat) {
      return;
    }

    try {
      const url = new URL(window.location.href);
      const chatIdParam = url.searchParams.get('chat');
      if (!chatIdParam) {
        return;
      }
      const chat = chats.find((candidate) => candidate.id === chatIdParam);
      if (chat) {
        setCurrentChat(chat);
      }
    } catch {
      // Ignore malformed URLs; chat selection can continue from in-memory state.
    }
  }, [chats, currentChat, setCurrentChat]);

  return { startNewChat } as const;
}
