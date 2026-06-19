import { useCallback, useEffect, useRef, useState } from 'react';
import type { Chat, ChatGenerationState } from '../types';

const createEmptyGenerationState = (): ChatGenerationState => ({
  partialResponse: null,
  thinkingProcessContent: null,
  isReasoning: false,
  streamingComplete: true,
});

function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

interface UseChatGenerationRegistryParams {
  readonly chats: Chat[];
  readonly currentChat: Chat | null;
}

export function useChatGenerationRegistry({ chats, currentChat }: UseChatGenerationRegistryParams) {
  const [chatGenerationStates, setChatGenerationStates] = useState<
    Record<string, ChatGenerationState>
  >({});
  const [abortControllers, setAbortControllers] = useState<Record<string, AbortController>>({});

  const chatsRef = useLatestRef(chats);
  const currentChatRef = useLatestRef(currentChat);
  const abortControllersRef = useLatestRef(abortControllers);
  const generationStatesRef = useLatestRef(chatGenerationStates);
  const submittingChatIdsRef = useRef<Set<string>>(new Set<string>());
  const activeFlushTimersRef = useRef<Record<string, number>>({});
  const activeStreamRunIdsRef = useRef<Record<string, string>>({});

  const currentGenerationState = currentChat ? chatGenerationStates[currentChat.id] : undefined;
  const partialResponse = currentGenerationState?.partialResponse ?? null;
  const streamingComplete = currentGenerationState?.streamingComplete ?? true;
  const isLoading = currentChat ? Boolean(abortControllers[currentChat.id]) : false;
  const generatingChatIds = Object.keys(abortControllers);

  const updateChatGenerationState = useCallback(
    (chatId: string, updates: Partial<ChatGenerationState>) => {
      setChatGenerationStates((prev) => {
        const next = {
          ...prev,
          [chatId]: {
            ...(prev[chatId] ?? createEmptyGenerationState()),
            ...updates,
          },
        };
        generationStatesRef.current = next;
        return next;
      });
    },
    [generationStatesRef]
  );

  const clearChatGenerationState = useCallback(
    (chatId: string) => {
      setChatGenerationStates((prev) => {
        const next = { ...prev };
        delete next[chatId];
        generationStatesRef.current = next;
        return next;
      });
    },
    [generationStatesRef]
  );

  const setAbortControllerForChat = useCallback(
    (chatId: string, controller: AbortController) => {
      setAbortControllers((prev) => {
        const next = { ...prev, [chatId]: controller };
        abortControllersRef.current = next;
        return next;
      });
    },
    [abortControllersRef]
  );

  const removeAbortControllerForChat = useCallback(
    (chatId: string) => {
      setAbortControllers((prev) => {
        const next = { ...prev };
        delete next[chatId];
        abortControllersRef.current = next;
        return next;
      });
    },
    [abortControllersRef]
  );

  return {
    chatGenerationStates,
    abortControllers,
    generatingChatIds,
    partialResponse,
    streamingComplete,
    isLoading,
    chatsRef,
    currentChatRef,
    abortControllersRef,
    generationStatesRef,
    submittingChatIds: submittingChatIdsRef.current,
    activeFlushTimersRef,
    activeStreamRunIdsRef,
    updateChatGenerationState,
    clearChatGenerationState,
    setAbortControllerForChat,
    removeAbortControllerForChat,
  } as const;
}
