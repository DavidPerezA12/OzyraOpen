import { getModelInfo, getOpenRouterApiModelId, getReasoningConfig } from '../../config/models';
import { getWebSearchSettings } from '../search/settings';
import { normalizeMessageRole, prepareSystemMessages } from '../../utils/chatOperations';
import type { ChatCompletionRequest, ChatMessage } from '../chatService';
import type { MessageRecord } from '../../utils/db';
import type { Chat, Message, MessageAnnotation, UploadedImage } from '../../types';

export type ReasoningLevel = 'low' | 'medium' | 'high';

export type ChatPreferencesSnapshot = {
  readonly userName: string;
  readonly userKnowledge: string;
  readonly userTraits: string;
  readonly userAdditionalInfo: string;
};

export type SubmitChatOptions = {
  readonly useWebSearch?: boolean;
  readonly reasoningLevel?: ReasoningLevel;
  readonly contentOverride?: string;
  readonly attachmentsOverride?: UploadedImage[];
  readonly chatSnapshot?: Chat;
};

export type StreamRequestConfig = {
  readonly apiModelId: string;
  readonly supportsReasoning: boolean;
  readonly requestTools: ChatCompletionRequest['tools'];
  readonly reasoning?: ChatCompletionRequest['reasoning'];
};

export const createWebSearchTool = (): NonNullable<ChatCompletionRequest['tools']>[number] => ({
  type: 'openrouter:web_search',
  parameters: (() => {
    const settings = getWebSearchSettings();
    return {
      max_results: settings.maxResults,
      search_context_size: settings.contextSize,
    };
  })(),
});

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
  id: crypto.randomUUID(),
  role: 'user',
  content,
  timestamp: Date.now(),
  model,
  useWebSearch,
  attachments: images.map((image) => ({
    type: 'image',
    name: 'Imagen adjunta',
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
  id: crypto.randomUUID(),
  role: 'assistant',
  content: '',
  timestamp: Date.now(),
  model,
  useWebSearch: useWebSearch || undefined,
});

export const buildBaseMessages = ({
  chat,
  preferences,
  webSearchContext,
  maxHistoryMessages = 10,
}: {
  readonly chat: Chat;
  readonly preferences: ChatPreferencesSnapshot;
  readonly webSearchContext?: string;
  readonly maxHistoryMessages?: number;
}): ChatCompletionRequest['messages'] => [
  ...prepareSystemMessages(chat, preferences),
  ...(webSearchContext ? [{ role: 'system' as const, content: webSearchContext }] : []),
  ...chat.messages.slice(-maxHistoryMessages).map(mapMessageToChatMessage),
];

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
  const supportsReasoning = Boolean(modelInfo?.capabilities?.reasoning);
  const apiModelId = useWebSearchTool
    ? getOpenRouterApiModelId(modelId).replace(/:online$/, '')
    : getOpenRouterApiModelId(modelId);
  const baseModelForCaps = apiModelId.split(':')[0];
  const reasoning = supportsReasoning
    ? getReasoningConfig(
        baseModelForCaps,
        reasoningLevel ? { effort: reasoningLevel } : undefined
      ) || { enabled: true }
    : undefined;
  const requestTools: ChatCompletionRequest['tools'] = [
    ...(useWebSearchTool ? [createWebSearchTool()] : []),
  ];

  return {
    apiModelId,
    supportsReasoning,
    requestTools,
    reasoning,
  };
};

export const buildStreamRequest = ({
  baseMessages,
  config,
}: {
  readonly baseMessages: ChatCompletionRequest['messages'];
  readonly config: StreamRequestConfig;
}): ChatCompletionRequest => ({
  messages: baseMessages,
  model: config.apiModelId,
  temperature: 0.7,
  max_tokens: 2048,
  ...(config.requestTools && config.requestTools.length > 0
    ? { tools: config.requestTools, tool_choice: 'auto' as const }
    : {}),
  ...(config.reasoning ? { reasoning: config.reasoning } : {}),
});

export const buildUserMessageRecord = ({
  message,
  chatId,
  userId,
}: {
  readonly message: Message;
  readonly chatId: string;
  readonly userId: string;
}): MessageRecord => ({
  id: message.id,
  chat_id: chatId,
  role: 'user',
  content: message.content.trim(),
  timestamp: message.timestamp,
  model: message.model,
  attachments: message.attachments,
  user_id: userId,
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

export const buildAssistantMessageRecord = ({
  message,
  chatId,
  userId,
}: {
  readonly message: Message;
  readonly chatId: string;
  readonly userId: string;
}): MessageRecord => ({
  id: message.id,
  chat_id: chatId,
  role: 'assistant',
  content: message.content.trim(),
  timestamp: message.timestamp,
  model: message.model,
  thinking_content: message.thinkingContent,
  use_web_search: message.useWebSearch,
  search_queries: message.searchQueries,
  annotations: message.annotations,
  user_id: userId,
});
