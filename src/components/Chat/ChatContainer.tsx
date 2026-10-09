import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { modelHasCapability } from '../../models/catalog';
import { t } from '../../i18n';
import type { Chat, Message } from '../../types';
import { readLocalStorage } from '../../utils/browserStorage';
import { ChatMessageItem } from './ChatMessageItem';

interface ChatContainerProps {
  readonly currentChat: Chat | null;
  readonly isDarkMode: boolean;
  readonly isLoading: boolean;
  readonly selectedModel: string;
  readonly editingMessageId: string | null;
  readonly editingContent: string;
  readonly copyToClipboard: (text: string) => void;
  readonly startEditingMessage: (message: Message) => void;
  readonly saveMessageEdit: (messageId: string) => void;
  readonly cancelMessageEdit: () => void;
  readonly regenerateResponse: (messageId?: string) => void;
  readonly setEditingContent: (content: string) => void;
}

const getInitialShowThinking = (): boolean => {
  const stored = readLocalStorage('ozyra:ui:showThinking');
  return stored === null ? true : stored === '1';
};

interface ChatMessageRowProps {
  readonly message: Message;
  readonly isLatest: boolean;
  readonly isDarkMode: boolean;
  readonly isLoading: boolean;
  readonly isStreamingAssistant: boolean;
  readonly isExpanded: boolean;
  readonly isCopied: boolean;
  readonly showThinking: boolean;
  readonly supportsReasoning: boolean;
  readonly editingMessageId: string | null;
  readonly editingContent: string;
  readonly copyToClipboard: (text: string) => void;
  readonly startEditingMessage: (message: Message) => void;
  readonly saveMessageEdit: (messageId: string) => void;
  readonly cancelMessageEdit: () => void;
  readonly regenerateResponse: (messageId?: string) => void;
  readonly setEditingContent: (content: string) => void;
  readonly onCopyMessage: (message: Message) => void;
  readonly onToggleExpansion: (messageId: string) => void;
}

// Fila memoizada: evita re-render de mensajes antiguos cuando solo cambia
// el draft del asistente en streaming (updateMessageInChat preserva refs).
const ChatMessageRow: React.FC<ChatMessageRowProps> = React.memo(
  ({
    message,
    isLatest,
    isDarkMode,
    isLoading,
    isStreamingAssistant,
    isExpanded,
    isCopied,
    showThinking,
    supportsReasoning,
    ...rest
  }) => {
    const presentation = useMemo(
      () => ({
        isLatest,
        isDarkMode,
        isLoading,
        isStreamingAssistant,
        isExpanded,
        isCopied,
        showThinking,
        supportsReasoning,
      }),
      [
        isLatest,
        isDarkMode,
        isLoading,
        isStreamingAssistant,
        isExpanded,
        isCopied,
        showThinking,
        supportsReasoning,
      ]
    );

    return <ChatMessageItem message={message} presentation={presentation} {...rest} />;
  }
);
ChatMessageRow.displayName = 'ChatMessageRow';

const ChatContainer: React.FC<ChatContainerProps> = ({
  currentChat,
  isDarkMode,
  isLoading,
  selectedModel,
  editingMessageId,
  editingContent,
  copyToClipboard,
  startEditingMessage,
  saveMessageEdit,
  cancelMessageEdit,
  regenerateResponse,
  setEditingContent,
}) => {
  const copiedMessageTimeoutRef = useRef<number | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [showThinking, setShowThinking] = useState(getInitialShowThinking);

  useEffect(
    () => () => {
      if (copiedMessageTimeoutRef.current !== null) {
        window.clearTimeout(copiedMessageTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'ozyra:ui:showThinking') {
        setShowThinking(event.newValue === '1');
      }
    };
    const handleThinkingChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ value: boolean }>;
      if (typeof customEvent.detail?.value === 'boolean') {
        setShowThinking(customEvent.detail.value);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('ozyra:ui:showThinking-changed', handleThinkingChanged);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('ozyra:ui:showThinking-changed', handleThinkingChanged);
    };
  }, []);

  const messageSupportsReasoning = useCallback(
    (message: Message) => {
      const modelId = message.model || selectedModel;
      try {
        return modelHasCapability(modelId, 'reasoning') || modelHasCapability(modelId, 'thinking');
      } catch {
        return false;
      }
    },
    [selectedModel]
  );

  const lastAssistantMessage = useMemo(() => {
    const messages = currentChat?.messages ?? [];
    for (let index = messages.length - 1; index >= 0; index--) {
      const message = messages[index];
      if (message?.role === 'assistant') {
        return message;
      }
    }
    return null;
  }, [currentChat?.messages]);
  const lastAssistantId = lastAssistantMessage?.id ?? null;

  const lastMessageId = useMemo(() => {
    const messages = currentChat?.messages ?? [];
    return messages.length > 0 ? (messages[messages.length - 1]?.id ?? null) : null;
  }, [currentChat?.messages]);

  const toggleMessageExpansion = useCallback((messageId: string) => {
    setExpandedMessages((current) => {
      const next = new Set(current);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }, []);

  const handleCopyMessage = useCallback(
    (message: Message) => {
      copyToClipboard(message.content);
      setCopiedMessageId(message.id);

      if (copiedMessageTimeoutRef.current !== null) {
        window.clearTimeout(copiedMessageTimeoutRef.current);
      }

      copiedMessageTimeoutRef.current = window.setTimeout(() => {
        setCopiedMessageId((current) => (current === message.id ? null : current));
        copiedMessageTimeoutRef.current = null;
      }, 1200);
    },
    [copyToClipboard]
  );

  if (!currentChat) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ background: 'var(--bg-main)' }}
      >
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('emptyChatSelect')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-8 pb-44">
      {isLoading && (
        <div aria-live="polite" className="sr-only">
          {lastAssistantMessage?.content ?? ''}
        </div>
      )}

      {currentChat.messages.map((message) => {
        const isStreamingAssistant =
          message.role !== 'user' && isLoading && message.id === lastAssistantId;

        return (
          <ChatMessageRow
            key={message.id}
            message={message}
            isLatest={lastMessageId === message.id}
            isDarkMode={isDarkMode}
            isLoading={isLoading}
            isStreamingAssistant={isStreamingAssistant}
            isExpanded={expandedMessages.has(message.id)}
            isCopied={copiedMessageId === message.id}
            showThinking={showThinking}
            supportsReasoning={messageSupportsReasoning(message)}
            editingMessageId={editingMessageId}
            editingContent={editingContent}
            copyToClipboard={copyToClipboard}
            startEditingMessage={startEditingMessage}
            saveMessageEdit={saveMessageEdit}
            cancelMessageEdit={cancelMessageEdit}
            regenerateResponse={regenerateResponse}
            setEditingContent={setEditingContent}
            onCopyMessage={handleCopyMessage}
            onToggleExpansion={toggleMessageExpansion}
          />
        );
      })}
    </div>
  );
};

export default ChatContainer;
