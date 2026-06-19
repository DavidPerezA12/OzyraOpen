import { useCallback, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import toast from 'react-hot-toast';
import { availableModels, recordModelUsage } from '../config/models';
import {
  runAssistantStream,
  type AssistantDraftUpdate,
} from '../services/chat/assistantStreamRunner';
import { getStoredOpenRouterApiKey } from '../services/openrouter/client';
import {
  buildBaseMessages,
  buildStreamRequest,
  createAssistantDraft,
  createUserMessage,
  getStreamRequestConfig,
  type ChatPreferencesSnapshot,
  type SubmitChatOptions,
} from '../services/chat/generationPipeline';
import { createLocalChat, updateMessageInChat, upsertChat } from '../services/chat/chatState';
import {
  persistChatIfNeeded,
  saveAssistantMessageToLocalHistory,
  saveGeneratedTitleToLocalHistory,
  saveUserMessageToLocalHistory,
} from '../services/chat/localChatPersistence';
import { buildRegenerationPlan } from '../services/chat/regenerationPlan';
import { resolveWebSearchForMessage } from '../services/chat/webSearchResolution';
import type { Chat, ChatGenerationState, Message, ModelTier, UploadedImage } from '../types';
import { deleteMessagesByIds } from '../utils/db';
import { generateChatTitle } from '../utils/chatOperations';
import { useChatGenerationRegistry } from './useChatGenerationRegistry';

type IncrementUsage = (modelTier: ModelTier, userId: string | null) => Promise<void>;

const MISSING_OPENROUTER_KEY_MESSAGE =
  'Configura tu clave de OpenRouter en Ajustes > Perfil local.';

export interface UseChatGenerationParams {
  readonly userId: string | null;
  readonly chats: Chat[];
  readonly setChats: Dispatch<SetStateAction<Chat[]>>;
  readonly currentChat: Chat | null;
  readonly setCurrentChat: Dispatch<SetStateAction<Chat | null>>;
  readonly selectedModel: string;
  readonly inputValue: string;
  readonly setInputValue: Dispatch<SetStateAction<string>>;
  readonly uploadedImages: UploadedImage[];
  readonly setUploadedImages: Dispatch<SetStateAction<UploadedImage[]>>;
  readonly preferences: ChatPreferencesSnapshot;
  readonly incrementUsage: IncrementUsage;
}

export interface UseChatGenerationReturn {
  readonly chatGenerationStates: Record<string, ChatGenerationState>;
  readonly abortControllers: Record<string, AbortController>;
  readonly generatingChatIds: string[];
  readonly partialResponse: string | null;
  readonly streamingComplete: boolean;
  readonly isLoading: boolean;
  readonly handleSubmit: (event: FormEvent, options?: SubmitChatOptions) => Promise<void>;
  readonly cancelGeneration: (chatId?: string) => void;
  readonly regenerateResponse: (messageId?: string) => Promise<void>;
}

const getModelTier = (modelId: string): ModelTier => {
  const modelInfo = availableModels.find((model) => model.id === modelId);
  return modelInfo?.tier ?? 'standard';
};

export function useChatGeneration({
  userId,
  chats,
  setChats,
  currentChat,
  setCurrentChat,
  selectedModel,
  inputValue,
  setInputValue,
  uploadedImages,
  setUploadedImages,
  preferences,
  incrementUsage,
}: UseChatGenerationParams): UseChatGenerationReturn {
  const {
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
    submittingChatIds,
    activeFlushTimersRef,
    activeStreamRunIdsRef,
    updateChatGenerationState,
    clearChatGenerationState,
    setAbortControllerForChat,
    removeAbortControllerForChat,
  } = useChatGenerationRegistry({ chats, currentChat });

  const createNewChat = useCallback((): Chat => createLocalChat(selectedModel), [selectedModel]);

  const ensureOpenRouterKey = useCallback((): boolean => {
    if (getStoredOpenRouterApiKey()) {
      return true;
    }

    toast.error(MISSING_OPENROUTER_KEY_MESSAGE);
    return false;
  }, []);

  const cancelGeneration = useCallback(
    (chatId?: string) => {
      const targetChatId = chatId || currentChatRef.current?.id;

      if (!targetChatId || !abortControllersRef.current[targetChatId]) {
        return;
      }

      abortControllersRef.current[targetChatId].abort();
      const activeFlushTimer = activeFlushTimersRef.current[targetChatId];
      if (activeFlushTimer !== undefined) {
        window.cancelAnimationFrame(activeFlushTimer);
        delete activeFlushTimersRef.current[targetChatId];
      }
      delete activeStreamRunIdsRef.current[targetChatId];
      submittingChatIds.delete(targetChatId);
      removeAbortControllerForChat(targetChatId);

      updateChatGenerationState(targetChatId, {
        partialResponse: null,
        streamingComplete: true,
        thinkingProcessContent: null,
        isReasoning: false,
      });

      const generatingChat = chatsRef.current.find((chat) => chat.id === targetChatId);
      const chatState = generationStatesRef.current[targetChatId];
      if (!generatingChat) {
        return;
      }

      const lastMessage = generatingChat.messages[generatingChat.messages.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') {
        return;
      }

      const partial = chatState?.partialResponse || lastMessage.content || '';
      let interruptedMessage: Message | null = null;
      const updatedChat = updateMessageInChat(generatingChat, lastMessage.id, (message) => {
        interruptedMessage = {
          ...message,
          content: `${partial}\n\n_(Generación interrumpida por el usuario)_`,
          thinkingContent: chatState?.thinkingProcessContent || message.thinkingContent,
        };
        return interruptedMessage;
      });

      if (currentChatRef.current?.id === targetChatId) {
        setCurrentChat(updatedChat);
      }
      setChats((prevChats) => upsertChat(prevChats, updatedChat));

      if (userId && generatingChat.isPersisted && interruptedMessage) {
        void saveAssistantMessageToLocalHistory({
          message: interruptedMessage,
          chatId: targetChatId,
          userId,
        }).catch((error) => {
          console.error('Error al guardar cancelación en historial local:', error);
        });
      }
    },
    [
      activeFlushTimersRef,
      activeStreamRunIdsRef,
      abortControllersRef,
      chatsRef,
      currentChatRef,
      generationStatesRef,
      removeAbortControllerForChat,
      setChats,
      setCurrentChat,
      submittingChatIds,
      updateChatGenerationState,
      userId,
    ]
  );

  const generateChatTitleForChat = useCallback(
    async (chat: Chat, userInput: string) => {
      const generatedTitle = await generateChatTitle(userInput, userId);

      if (!generatedTitle) {
        return;
      }

      setChats((prevChats) =>
        prevChats.map((candidate) =>
          candidate.id === chat.id ? { ...candidate, title: generatedTitle } : candidate
        )
      );
      setCurrentChat((prevChat) =>
        prevChat && prevChat.id === chat.id ? { ...prevChat, title: generatedTitle } : prevChat
      );

      try {
        await saveGeneratedTitleToLocalHistory({
          chatId: chat.id,
          title: generatedTitle,
          userId,
        });
      } catch (error) {
        console.error('Error al guardar título generado en historial local:', error);
      }
    },
    [setChats, setCurrentChat, userId]
  );

  const submitChatMessage = useCallback(
    async (options?: SubmitChatOptions) => {
      const submittedContent = options?.contentOverride ?? inputValue;
      const submittedImages =
        options?.attachmentsOverride ?? (options?.contentOverride ? [] : [...uploadedImages]);
      const submittedModel = selectedModel;

      if (!submittedContent.trim() && submittedImages.length === 0) {
        return;
      }

      if (!ensureOpenRouterKey()) {
        return;
      }

      const createdThisSubmit = !options?.chatSnapshot && !currentChatRef.current;
      let chatToUse: Chat = options?.chatSnapshot ?? currentChatRef.current ?? createNewChat();
      const chatId = chatToUse.id;

      if (submittingChatIds.has(chatId)) {
        console.warn('[handleSubmit] Ignorado: ya hay un submit en progreso para este chat');
        return;
      }
      submittingChatIds.add(chatId);

      if (abortControllersRef.current[chatId]) {
        cancelGeneration(chatId);
        submittingChatIds.delete(chatId);
        return;
      }

      const controller = new AbortController();
      setAbortControllerForChat(chatId, controller);

      if (!chatToUse.isPersisted && userId) {
        try {
          const persistedChat = await persistChatIfNeeded({ chat: chatToUse, userId });
          setCurrentChat(persistedChat);
          setChats((prevChats) => upsertChat(prevChats, persistedChat));
          chatToUse = persistedChat;
        } catch (dbError) {
          console.error('[handleSubmit] Error al crear nuevo chat local:', dbError);
          toast.error('Error al iniciar la nueva conversación. Revisa la consola.');
          submittingChatIds.delete(chatId);
          removeAbortControllerForChat(chatId);
          if (createdThisSubmit) {
            setChats((prevChats) => prevChats.filter((chat) => chat.id !== chatId));
            setCurrentChat(null);
          }
          return;
        }
      }

      try {
        updateChatGenerationState(chatId, {
          streamingComplete: false,
          partialResponse: null,
          thinkingProcessContent: null,
          isReasoning: false,
        });

        const useWebSearch = Boolean(options?.useWebSearch);
        const userMessage = createUserMessage({
          content: submittedContent,
          images: submittedImages,
          model: submittedModel,
          useWebSearch,
        });
        const updatedChat = {
          ...chatToUse,
          messages: [...chatToUse.messages, userMessage],
          model: submittedModel,
        };

        setCurrentChat(updatedChat);
        setChats((prevChats) => upsertChat(prevChats, updatedChat));

        if (userId) {
          try {
            await saveUserMessageToLocalHistory({
              message: userMessage,
              chatId: chatToUse.id,
              userId,
            });
          } catch (dbError) {
            console.error(
              '[handleSubmit] Error al guardar mensaje del usuario (continuando):',
              dbError
            );
          }
        }

        if (updatedChat.messages.length === 1) {
          void generateChatTitleForChat(updatedChat, userMessage.content);
        }

        if (!options?.contentOverride) {
          setInputValue('');
          setUploadedImages([]);
        }

        const webSearch = await resolveWebSearchForMessage(userMessage.content, useWebSearch);
        if (webSearch.fallbackMessage) {
          toast.error(webSearch.fallbackMessage);
        }

        const baseMessages = buildBaseMessages({
          chat: updatedChat,
          preferences,
          webSearchContext: webSearch.webSearchContext,
        });

        const assistantDraft = createAssistantDraft({
          model: submittedModel,
          useWebSearch,
        });
        const assistantMessageId = assistantDraft.id;
        const chatWithDraft = {
          ...updatedChat,
          messages: [...updatedChat.messages, assistantDraft],
        };
        setCurrentChat(chatWithDraft);
        setChats((prevChats) =>
          prevChats.map((chat) =>
            chat.id === chatWithDraft.id ? { ...chatWithDraft, title: chat.title } : chat
          )
        );

        const applyAssistantDraftUpdate = (updates: AssistantDraftUpdate) => {
          const updateDraft = (message: Message): Message => ({
            ...message,
            content:
              updates.partialResponse !== undefined
                ? (updates.partialResponse ?? '')
                : message.content,
            thinkingContent:
              updates.thinkingProcessContent !== undefined
                ? updates.thinkingProcessContent || undefined
                : message.thinkingContent,
          });

          setCurrentChat((prev) =>
            prev && prev.id === chatId
              ? updateMessageInChat(prev, assistantMessageId, updateDraft)
              : prev
          );
          setChats((prevChats) =>
            prevChats.map((chat) =>
              chat.id === chatId ? updateMessageInChat(chat, assistantMessageId, updateDraft) : chat
            )
          );
        };

        const streamConfig = getStreamRequestConfig({
          modelId: submittedModel,
          useWebSearchTool: webSearch.shouldUseWebSearchTool,
          reasoningLevel: options?.reasoningLevel,
        });
        const streamRequest = buildStreamRequest({
          baseMessages,
          config: streamConfig,
        });

        console.info('[App] Stream request', {
          selectedModel: submittedModel,
          apiModelId: streamConfig.apiModelId,
          usesWebSearchTool: webSearch.shouldUseWebSearchTool,
          directWebSearchProvider: webSearch.directWebSearch?.provider,
          supportsReasoning: streamConfig.supportsReasoning,
          reasoningKeys: streamConfig.reasoning ? Object.keys(streamConfig.reasoning) : [],
        });

        const finalAssistantMessage = await runAssistantStream({
          chatId,
          assistantMessageId,
          submittedModel,
          useWebSearch,
          directWebSearch: webSearch.directWebSearch,
          streamRequest,
          controller,
          activeFlushTimersRef,
          activeStreamRunIdsRef,
          onDraftUpdate: (updates) => {
            updateChatGenerationState(chatId, updates);
            applyAssistantDraftUpdate(updates);
          },
        });
        recordModelUsage(submittedModel);

        const replaceAssistantDraft = (): ((message: Message) => Message) => (message) => ({
          ...message,
          content: finalAssistantMessage.content,
          thinkingContent: finalAssistantMessage.thinkingContent,
          useWebSearch: finalAssistantMessage.useWebSearch,
          searchQueries: finalAssistantMessage.searchQueries,
          annotations: finalAssistantMessage.annotations,
        });

        setCurrentChat((prev) =>
          prev && prev.id === chatId
            ? updateMessageInChat(prev, assistantMessageId, replaceAssistantDraft())
            : prev
        );
        setChats((prevChats) =>
          prevChats.map((chat) =>
            chat.id === chatId
              ? updateMessageInChat(chat, assistantMessageId, replaceAssistantDraft())
              : chat
          )
        );

        updateChatGenerationState(chatId, {
          streamingComplete: true,
        });

        if (userId) {
          try {
            const saveResult = await saveAssistantMessageToLocalHistory({
              message: finalAssistantMessage,
              chatId: chatToUse.id,
              userId,
            });
            if (saveResult === 'empty') {
              console.warn('Mensaje del asistente vacío, no se guardará en el historial local');
            }
          } catch (error) {
            console.error('Error al guardar respuesta AI:', error);
            toast.error('Error al guardar la respuesta del asistente.');
          }
        }

        await incrementUsage(getModelTier(submittedModel), userId);
        removeAbortControllerForChat(chatToUse.id);
      } catch (error: unknown) {
        const isAbortError =
          (error instanceof DOMException && error.name === 'AbortError') ||
          (error instanceof Error && error.name === 'AbortError');

        if (isAbortError) {
          console.info('Solicitud cancelada por el usuario');
        } else {
          console.error('Error al enviar mensaje:', error);
          toast.error('Error al enviar el mensaje');
          clearChatGenerationState(chatId);
        }
      } finally {
        submittingChatIds.delete(chatId);
        const activeFlushTimer = activeFlushTimersRef.current[chatId];
        if (activeFlushTimer !== undefined) {
          window.cancelAnimationFrame(activeFlushTimer);
          delete activeFlushTimersRef.current[chatId];
        }
        delete activeStreamRunIdsRef.current[chatId];
        removeAbortControllerForChat(chatId);
        clearChatGenerationState(chatId);
      }
    },
    [
      activeFlushTimersRef,
      activeStreamRunIdsRef,
      abortControllersRef,
      cancelGeneration,
      clearChatGenerationState,
      createNewChat,
      currentChatRef,
      generateChatTitleForChat,
      incrementUsage,
      inputValue,
      ensureOpenRouterKey,
      preferences,
      removeAbortControllerForChat,
      selectedModel,
      setAbortControllerForChat,
      setChats,
      setCurrentChat,
      setInputValue,
      setUploadedImages,
      submittingChatIds,
      updateChatGenerationState,
      uploadedImages,
      userId,
    ]
  );

  const handleSubmit = useCallback(
    async (event: FormEvent, options?: SubmitChatOptions) => {
      event.preventDefault();
      await submitChatMessage(options);
    },
    [submitChatMessage]
  );

  const regenerateResponse = useCallback(
    async (messageId?: string) => {
      const chat = currentChatRef.current;
      if (!chat) {
        return;
      }
      if (!ensureOpenRouterKey()) {
        return;
      }
      if (submittingChatIds.has(chat.id) || abortControllersRef.current[chat.id]) {
        toast.error('Ya hay una generación en curso');
        return;
      }

      const regenerationPlan = buildRegenerationPlan(chat, messageId);
      if (!regenerationPlan) {
        toast.error('No se puede regenerar esta respuesta');
        return;
      }
      const { userMessage, updatedChat, removedMessageIds, attachmentsOverride } = regenerationPlan;

      setCurrentChat(updatedChat);
      setChats((prev) =>
        prev.map((candidate) => (candidate.id === chat.id ? updatedChat : candidate))
      );
      if (removedMessageIds.length > 0 && chat.isPersisted) {
        deleteMessagesByIds(chat.id, removedMessageIds).catch((error) => {
          console.error('Error al limpiar mensajes regenerados en historial local:', error);
          toast.error('No se pudo actualizar el historial persistido');
        });
      }

      setTimeout(() => {
        const element = document.getElementById(`message-${userMessage.id}`);
        if (element) {
          element.classList.add('regenerating-pulse');
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => element.classList.remove('regenerating-pulse'), 2000);
        }
      }, 100);

      await submitChatMessage({
        contentOverride: userMessage.content,
        attachmentsOverride,
        chatSnapshot: updatedChat,
      });
    },
    [
      abortControllersRef,
      currentChatRef,
      ensureOpenRouterKey,
      setChats,
      setCurrentChat,
      submitChatMessage,
      submittingChatIds,
    ]
  );

  return {
    chatGenerationStates,
    abortControllers,
    generatingChatIds,
    partialResponse,
    streamingComplete,
    isLoading,
    handleSubmit,
    cancelGeneration,
    regenerateResponse,
  };
}
