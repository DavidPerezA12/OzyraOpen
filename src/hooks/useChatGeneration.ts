import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react';
import toast from 'react-hot-toast';
import { t } from '../i18n';
import { recordModelUsage } from '../models/usage';
import { runAssistantStream } from '../services/chat/assistantStreamRunner';
import {
  applyAssistantDraftUpdate,
  applyFinalAssistantMessage,
  markAssistantMessageInterrupted,
} from '../services/chat/assistantMessageLifecycle';
import { getStoredOpenRouterApiKey, normalizeOpenRouterError } from '../services/openrouter/client';
import {
  buildBaseMessages,
  buildStreamRequest,
  createAssistantDraft,
  createUserMessage,
  getStreamRequestConfig,
  type ReasoningLevel,
  type SubmitChatOptions,
} from '../services/chat/generationPipeline';
import { createLocalChat, updateMessageInChat } from '../services/chat/chatState';
import {
  persistChatIfNeeded,
  saveGeneratedTitleToLocalHistory,
  saveMessageToLocalHistory,
} from '../services/chat/localChatPersistence';
import { buildRegenerationPlan } from '../services/chat/regenerationPlan';
import { resolveWebSearchForMessage } from '../services/chat/webSearchResolution';
import type { ChatStore } from '../state/chatStore';
import type { Chat, Message, UploadedImage } from '../types';
import { deleteMessagesByIds } from '../utils/db';
import { generateChatTitle } from '../utils/chatOperations';
import { isAbortError } from '../utils/errors';
import { logger } from '../utils/logger';
import type { UserPreferences } from '../utils/userPreferences';

export interface ComposerState {
  readonly inputValue: string;
  readonly setInputValue: (value: string) => void;
  readonly uploadedImages: readonly UploadedImage[];
  readonly setUploadedImages: Dispatch<SetStateAction<UploadedImage[]>>;
}

export interface UseChatGenerationParams {
  readonly store: ChatStore;
  readonly selectedModel: string;
  readonly composer: ComposerState;
  readonly preferences: UserPreferences;
}

interface ActiveGeneration {
  readonly controller: AbortController;
  /** Borrador del asistente de esta generación (aún no existe mientras se prepara) */
  draftMessageId?: string;
}

const createAbortError = (): DOMException => new DOMException('Generation cancelled', 'AbortError');

const throwIfAborted = (signal: AbortSignal): void => {
  if (signal.aborted) {
    throw createAbortError();
  }
};

const ensureOpenRouterKey = (): boolean => {
  if (getStoredOpenRouterApiKey()) {
    return true;
  }
  toast.error(t('missingOpenRouterKey'));
  return false;
};

const highlightMessage = (messageId: string): void => {
  window.setTimeout(() => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.classList.add('regenerating-pulse');
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => element.classList.remove('regenerating-pulse'), 2000);
    }
  }, 100);
};

/**
 * Envío, streaming, cancelación y regeneración de respuestas.
 *
 * Cada chat puede tener una generación activa a la vez (varias en paralelo
 * entre chats). Todo el estado de los chats vive en el `ChatStore`: el hook
 * solo guarda qué generaciones están en curso.
 */
export function useChatGeneration({
  store,
  selectedModel,
  composer,
  preferences,
}: UseChatGenerationParams) {
  const generationsRef = useRef(new Map<string, ActiveGeneration>());
  const [generatingChatIds, setGeneratingChatIds] = useState<readonly string[]>([]);

  const syncGeneratingIds = useCallback(() => {
    setGeneratingChatIds([...generationsRef.current.keys()]);
  }, []);

  const startGeneration = useCallback(
    (chatId: string): ActiveGeneration => {
      const generation: ActiveGeneration = { controller: new AbortController() };
      generationsRef.current.set(chatId, generation);
      syncGeneratingIds();
      return generation;
    },
    [syncGeneratingIds]
  );

  const finishGeneration = useCallback(
    (chatId: string, generation: ActiveGeneration) => {
      // Solo la generación que sigue registrada puede limpiarse a sí misma.
      if (generationsRef.current.get(chatId) === generation) {
        generationsRef.current.delete(chatId);
        syncGeneratingIds();
      }
    },
    [syncGeneratingIds]
  );

  const cancelGeneration = useCallback(
    (chatId?: string) => {
      const targetChatId = chatId ?? store.getState().currentChatId;
      const generation = targetChatId ? generationsRef.current.get(targetChatId) : undefined;
      if (!targetChatId || !generation) {
        return;
      }

      generation.controller.abort();
      finishGeneration(targetChatId, generation);

      const chat = store.getChat(targetChatId);
      const draft = chat?.messages.find((message) => message.id === generation.draftMessageId);
      if (!chat || !draft) {
        return;
      }

      const interruptedMessage = markAssistantMessageInterrupted({ message: draft });
      store.updateChat(targetChatId, (current) =>
        updateMessageInChat(current, draft.id, () => interruptedMessage)
      );
      if (chat.isPersisted) {
        saveMessageToLocalHistory(interruptedMessage, targetChatId).catch((error: unknown) => {
          logger.error('Error al guardar cancelación en historial local:', error);
        });
      }
    },
    [finishGeneration, store]
  );

  const generateTitle = useCallback(
    async (chatId: string, userInput: string) => {
      const title = await generateChatTitle(userInput);
      if (!title || !store.getChat(chatId)) {
        return;
      }
      store.updateChat(chatId, (chat) => ({ ...chat, title }));
      try {
        await saveGeneratedTitleToLocalHistory(chatId, title);
      } catch (error) {
        logger.error('Error al guardar título generado en historial local:', error);
      }
    },
    [store]
  );

  /**
   * Genera la respuesta del asistente para `chat`, cuyo último mensaje es el
   * mensaje de usuario a responder (nuevo o, al regenerar, el existente).
   */
  const generateResponse = useCallback(
    async ({
      chat,
      userMessage,
      model,
      reasoningLevel,
      generation,
    }: {
      readonly chat: Chat;
      readonly userMessage: Message;
      readonly model: string;
      readonly reasoningLevel?: ReasoningLevel;
      readonly generation: ActiveGeneration;
    }) => {
      const chatId = chat.id;
      const { signal } = generation.controller;
      const useWebSearch = Boolean(userMessage.useWebSearch);

      const webSearch = await resolveWebSearchForMessage(userMessage.content, useWebSearch);
      throwIfAborted(signal);
      if (webSearch.fallbackMessage) {
        toast.error(webSearch.fallbackMessage);
      }

      const streamConfig = getStreamRequestConfig({
        modelId: model,
        useWebSearchTool: webSearch.shouldUseWebSearchTool,
        reasoningLevel,
      });
      const streamRequest = buildStreamRequest({
        baseMessages: buildBaseMessages({
          chat,
          preferences,
          webSearchContext: webSearch.webSearchContext,
          promptTokenBudget: streamConfig.promptTokenBudget,
        }),
        config: streamConfig,
        sessionId: chatId,
      });

      logger.info('[Generation] Stream request', {
        selectedModel: model,
        apiModelId: streamConfig.apiModelId,
        usesWebSearchTool: webSearch.shouldUseWebSearchTool,
        directWebSearchProvider: webSearch.directWebSearch?.provider,
        reasoning: streamConfig.reasoning,
        maxTokens: streamConfig.maxTokens,
        promptCaching: Boolean(streamRequest.cache_control),
      });

      const draft = createAssistantDraft({ model, useWebSearch });
      generation.draftMessageId = draft.id;
      store.updateChat(chatId, (current) => ({
        ...current,
        messages: [...current.messages, draft],
      }));

      const updateDraft = (update: (message: Message) => Message) =>
        store.updateChat(chatId, (current) => updateMessageInChat(current, draft.id, update));

      let result: Awaited<ReturnType<typeof runAssistantStream>>;
      try {
        result = await runAssistantStream({
          assistantMessageId: draft.id,
          submittedModel: model,
          useWebSearch,
          directWebSearch: webSearch.directWebSearch,
          streamRequest,
          signal,
          onDraftUpdate: (updates) =>
            updateDraft((message) => applyAssistantDraftUpdate(message, updates)),
        });
      } catch (error) {
        // Si falló antes del primer token, no dejar una burbuja vacía.
        const failedDraft = store
          .getChat(chatId)
          ?.messages.find((message) => message.id === draft.id);
        if (!isAbortError(error) && failedDraft && !failedDraft.content.trim()) {
          store.updateChat(chatId, (current) => ({
            ...current,
            messages: current.messages.filter((message) => message.id !== draft.id),
          }));
        }
        throw error;
      }

      throwIfAborted(signal);
      const finalMessage = result.message;
      recordModelUsage(model);
      updateDraft((message) => applyFinalAssistantMessage(message, finalMessage));

      if (result.finishReason === 'length') {
        toast.error(
          finalMessage.content.trim() ? t('responseTruncated') : t('responseTruncatedEmpty'),
          { id: `truncated-${chatId}` }
        );
      }

      try {
        if ((await saveMessageToLocalHistory(finalMessage, chatId)) === 'empty') {
          logger.warn('Mensaje del asistente vacío, no se guardará en el historial local');
        }
      } catch (error) {
        logger.error('Error al guardar respuesta AI:', error);
        toast.error(t('assistantSaveError'));
      }
    },
    [preferences, store]
  );

  const runGeneration = useCallback(
    async (chatId: string, generation: ActiveGeneration, run: () => Promise<void>) => {
      try {
        await run();
      } catch (error) {
        if (isAbortError(error)) {
          logger.info('Solicitud cancelada por el usuario');
        } else {
          logger.error('Error al enviar mensaje:', error);
          // Los errores de OpenRouter ya vienen traducidos (clave inválida, rate-limit…).
          const cause = normalizeOpenRouterError(error);
          toast.error(cause.message || t('sendMessageError'), { id: `send-error-${chatId}` });
        }
      } finally {
        finishGeneration(chatId, generation);
      }
    },
    [finishGeneration]
  );

  const submitMessage = useCallback(
    async (options?: SubmitChatOptions) => {
      const content = composer.inputValue;
      const images = [...composer.uploadedImages];
      const model = selectedModel;

      if (!content.trim() && images.length === 0) {
        return;
      }
      if (!ensureOpenRouterKey()) {
        return;
      }

      let chat = store.getCurrentChat() ?? createLocalChat(model);
      const chatId = chat.id;
      const isNewChat = !store.getChat(chatId);

      // Enviar mientras se genera actúa como "detener".
      if (generationsRef.current.has(chatId)) {
        cancelGeneration(chatId);
        return;
      }
      const generation = startGeneration(chatId);

      await runGeneration(chatId, generation, async () => {
        if (!chat.isPersisted) {
          try {
            chat = await persistChatIfNeeded(chat);
          } catch (error) {
            logger.error('[Generation] Error al crear nuevo chat local:', error);
            toast.error(t('newChatError'));
            return;
          }
          throwIfAborted(generation.controller.signal);
        }

        const userMessage = createUserMessage({
          content,
          images,
          model,
          useWebSearch: Boolean(options?.useWebSearch),
        });
        const chatWithMessage: Chat = {
          ...chat,
          messages: [...chat.messages, userMessage],
          model,
        };
        if (isNewChat) {
          store.upsertChat(chatWithMessage);
          if (store.getState().currentChatId === null) {
            store.selectChat(chatId);
          }
        } else {
          store.updateChat(chatId, (current) => ({
            ...current,
            isPersisted: true,
            model,
            messages: [...current.messages, userMessage],
          }));
        }

        composer.setInputValue('');
        composer.setUploadedImages([]);

        try {
          await saveMessageToLocalHistory(userMessage, chatId);
        } catch (error) {
          logger.error('[Generation] Error al guardar mensaje del usuario (continuando):', error);
        }
        throwIfAborted(generation.controller.signal);

        if (chatWithMessage.messages.length === 1) {
          void generateTitle(chatId, userMessage.content);
        }

        await generateResponse({
          chat: store.getChat(chatId) ?? chatWithMessage,
          userMessage,
          model,
          reasoningLevel: options?.reasoningLevel,
          generation,
        });
      });
    },
    [
      cancelGeneration,
      composer,
      generateResponse,
      generateTitle,
      runGeneration,
      selectedModel,
      startGeneration,
      store,
    ]
  );

  const handleSubmit = useCallback(
    async (event: FormEvent, options?: SubmitChatOptions) => {
      event.preventDefault();
      await submitMessage(options);
    },
    [submitMessage]
  );

  /**
   * Regenera la respuesta a partir del mensaje de usuario anterior a
   * `messageId` (o del último). Reutiliza ese mensaje: solo se descartan las
   * respuestas posteriores.
   */
  const regenerateResponse = useCallback(
    async (messageId?: string) => {
      const chat = store.getCurrentChat();
      if (!chat || !ensureOpenRouterKey()) {
        return;
      }
      if (generationsRef.current.has(chat.id)) {
        toast.error(t('generationInProgress'));
        return;
      }

      const plan = buildRegenerationPlan(chat, messageId);
      if (!plan) {
        toast.error(t('cannotRegenerate'));
        return;
      }

      const generation = startGeneration(chat.id);
      store.updateChat(chat.id, () => plan.updatedChat);
      if (plan.removedMessageIds.length > 0 && chat.isPersisted) {
        deleteMessagesByIds(chat.id, plan.removedMessageIds).catch((error: unknown) => {
          logger.error('Error al limpiar mensajes regenerados en historial local:', error);
          toast.error(t('persistHistoryError'));
        });
      }
      highlightMessage(plan.userMessage.id);

      await runGeneration(chat.id, generation, () =>
        generateResponse({
          chat: plan.updatedChat,
          userMessage: plan.userMessage,
          model: selectedModel,
          generation,
        })
      );
    },
    [generateResponse, runGeneration, selectedModel, startGeneration, store]
  );

  return {
    generatingChatIds,
    handleSubmit,
    cancelGeneration,
    regenerateResponse,
  } as const;
}
