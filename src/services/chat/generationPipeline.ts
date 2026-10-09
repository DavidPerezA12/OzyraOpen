import { getModelInfo, getOpenRouterApiModelId } from '../../models/catalog';
import { GENERATION_CONFIG, HISTORY_CONFIG } from '../../config/constants';
import { t } from '../../i18n';
import { generateId } from '../../utils/id';
import { getWebSearchSettings } from '../search/settings';
import { normalizeMessageRole, prepareSystemMessages } from '../../utils/chatOperations';
import type { ChatCompletionRequest, ChatMessage, ReasoningLevel } from '../chatService';
import { getPromptCachingParams } from '../openrouter/promptCaching';
import type { Chat, Message, MessageAnnotation, UploadedImage } from '../../types';
import type { UserPreferences } from '../../utils/userPreferences';
import {
  DEFAULT_HISTORY_WINDOW_LIMITS,
  estimateTextTokens,
  selectHistoryWindow,
} from './historyWindow';
import { getOutputBudget } from './outputBudget';

export type { ReasoningLevel };

export type SubmitChatOptions = {
  readonly useWebSearch?: boolean;
  readonly reasoningLevel?: ReasoningLevel;
};

export type StreamRequestConfig = {
  readonly apiModelId: string;
  readonly supportsReasoning: boolean;
  readonly requestTools: ChatCompletionRequest['tools'];
  readonly reasoning?: ChatCompletionRequest['reasoning'];
  /** `max_tokens` de la petición (razonamiento + respuesta) */
  readonly maxTokens: number;
  /** Tokens disponibles para system + historial */
  readonly promptTokenBudget: number;
};

export const createWebSearchTool = (): NonNullable<ChatCompletionRequest['tools']>[number] => {
  const settings = getWebSearchSettings();
  return {
    type: 'openrouter:web_search',
    parameters: {
      max_results: settings.maxResults,
      search_context_size: settings.contextSize,
    },
  };
};

export const mapMessageToChatMessage = (message: Message): ChatMessage => {
  const imageAttachments =
    message.attachments?.filter((attachment) => attachment.type === 'image') ?? [];

  return {
    role: normalizeMessageRole(message.role),
    content: message.content,
    ...(imageAttachments.length > 0
      ? {
          images: imageAttachments.map((attachment) => ({
            url: attachment.url,
            contentType: attachment.contentType ?? 'image/png',
            data: attachment.data,
          })),
        }
      : {}),
  };
};

export const createUserMessage = ({
  content,
  images,
  model,
  useWebSearch,
}: {
  readonly content: string;
  readonly images: readonly UploadedImage[];
  readonly model: string;
  readonly useWebSearch: boolean;
}): Message => ({
  id: generateId(),
  role: 'user',
  content,
  timestamp: Date.now(),
  model,
  useWebSearch,
  attachments: images.map((image) => ({
    type: 'image',
    name: t('attachedImageName'),
    url: image.url,
    contentType: image.contentType,
    data: image.data,
  })),
});

export const createAssistantDraft = ({
  model,
  useWebSearch,
}: {
  readonly model: string;
  readonly useWebSearch: boolean;
}): Message => ({
  id: generateId(),
  role: 'assistant',
  content: '',
  timestamp: Date.now(),
  model,
  useWebSearch: useWebSearch || undefined,
});

/**
 * Antepone el contexto de búsqueda web al último mensaje de usuario.
 *
 * Va en el turno actual y no como mensaje `system` previo al historial: así
 * el prefijo (system + historial) no cambia cuando un turno usa búsqueda y
 * el prompt cache del proveedor sigue siendo válido. Además, varios
 * proveedores (Anthropic) agrupan todos los `system` en la cabecera, lo que
 * invalidaría el cache completo.
 */
const attachWebSearchContext = (
  messages: readonly ChatMessage[],
  webSearchContext: string
): ChatMessage[] => {
  const lastUserIndex = messages.map((message) => message.role).lastIndexOf('user');
  if (lastUserIndex === -1) {
    return [...messages, { role: 'user', content: webSearchContext }];
  }
  return messages.map((message, index) =>
    index === lastUserIndex
      ? {
          ...message,
          content: `${webSearchContext}\n\n--- MENSAJE DEL USUARIO ---\n${message.content}`,
        }
      : message
  );
};

/**
 * Construye los mensajes de la petición: system estable + ventana de
 * historial estable (ver `selectHistoryWindow`) + contexto web en el turno
 * actual. El orden importa para el prompt caching: todo lo que varía entre
 * turnos queda al final.
 */
export const buildBaseMessages = ({
  chat,
  preferences,
  webSearchContext,
  promptTokenBudget = HISTORY_CONFIG.MAX_TOKENS,
}: {
  readonly chat: Chat;
  readonly preferences: UserPreferences;
  readonly webSearchContext?: string;
  readonly promptTokenBudget?: number;
}): ChatCompletionRequest['messages'] => {
  const systemMessages = prepareSystemMessages(chat, preferences);
  const fixedTokens =
    systemMessages.reduce((total, message) => total + estimateTextTokens(message.content), 0) +
    (webSearchContext ? estimateTextTokens(webSearchContext) : 0);
  const history = selectHistoryWindow(chat.messages, {
    ...DEFAULT_HISTORY_WINDOW_LIMITS,
    maxTokens: Math.max(HISTORY_CONFIG.MIN_TOKENS, promptTokenBudget - fixedTokens),
  }).map(mapMessageToChatMessage);

  return [
    ...systemMessages,
    ...(webSearchContext ? attachWebSearchContext(history, webSearchContext) : history),
  ];
};

/**
 * Tokens de prompt disponibles: tope fijo (estable entre turnos, bueno para
 * el cache) recortado por la ventana de contexto del modelo si la conocemos.
 */
const getPromptTokenBudget = (contextLength: number | undefined, maxTokens: number): number => {
  if (!contextLength || contextLength <= 0) {
    return HISTORY_CONFIG.MAX_TOKENS;
  }
  const available = contextLength - maxTokens - HISTORY_CONFIG.CONTEXT_SAFETY_MARGIN_TOKENS;
  return Math.max(HISTORY_CONFIG.MIN_TOKENS, Math.min(HISTORY_CONFIG.MAX_TOKENS, available));
};

export const getStreamRequestConfig = ({
  modelId,
  useWebSearchTool,
  reasoningLevel,
}: {
  readonly modelId: string;
  readonly useWebSearchTool: boolean;
  readonly reasoningLevel?: ReasoningLevel;
}): StreamRequestConfig => {
  const modelInfo = getModelInfo(modelId);
  const supportsReasoning = Boolean(modelInfo?.capabilities.reasoning);
  const apiModelId = useWebSearchTool
    ? getOpenRouterApiModelId(modelId).replace(/:online$/, '')
    : getOpenRouterApiModelId(modelId);
  const { maxTokens, reasoning } = getOutputBudget({
    apiModelId,
    supportsReasoning,
    reasoningLevel,
    modelMaxOutputTokens: modelInfo?.maxTokens,
  });

  return {
    apiModelId,
    supportsReasoning,
    requestTools: useWebSearchTool ? [createWebSearchTool()] : [],
    reasoning,
    maxTokens,
    promptTokenBudget: getPromptTokenBudget(modelInfo?.contextLength, maxTokens),
  };
};

export const buildStreamRequest = ({
  baseMessages,
  config,
  sessionId,
}: {
  readonly baseMessages: ChatCompletionRequest['messages'];
  readonly config: StreamRequestConfig;
  /** Identificador estable de la conversación para el sticky routing del cache */
  readonly sessionId?: string;
}): ChatCompletionRequest => ({
  messages: baseMessages,
  model: config.apiModelId,
  temperature: GENERATION_CONFIG.TEMPERATURE,
  max_tokens: config.maxTokens,
  ...(config.requestTools && config.requestTools.length > 0
    ? { tools: config.requestTools, tool_choice: 'auto' as const }
    : {}),
  ...(config.reasoning ? { reasoning: config.reasoning } : {}),
  ...getPromptCachingParams({ apiModelId: config.apiModelId, sessionId }),
});

export const buildAssistantMessage = ({
  id,
  content,
  model,
  thinkingContent,
  useWebSearch,
  searchQueries,
  annotations,
}: {
  readonly id: string;
  readonly content: string;
  readonly model: string;
  readonly thinkingContent?: string;
  readonly useWebSearch?: boolean;
  readonly searchQueries?: readonly string[];
  readonly annotations?: readonly MessageAnnotation[];
}): Message => ({
  id,
  role: 'assistant',
  content,
  timestamp: Date.now(),
  model,
  thinkingContent,
  useWebSearch,
  searchQueries,
  annotations,
});
