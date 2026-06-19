import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { modelHasCapability } from '../../config/models';
import type { Chat, Message, ModelInfo } from '../../types';
import { ChatMessageItem } from './ChatMessageItem';

interface ChatContainerProps {
  readonly currentChat: Chat | null;
  readonly isDarkMode: boolean;
  readonly isLoading: boolean;
  readonly partialResponse: string | null;
  readonly streamingComplete: boolean;
  readonly selectedModel: string;
  readonly editingMessageId: string | null;
  readonly editingContent: string;
  readonly copyToClipboard: (text: string) => void;
  readonly startEditingMessage: (message: Message) => void;
  readonly saveMessageEdit: (messageId: string) => void;
  readonly cancelMessageEdit: () => void;
  readonly regenerateResponse: (messageId?: string) => void;
  readonly setEditingContent: (content: string) => void;
  readonly availableModels: readonly ModelInfo[];
}

const getInitialShowThinking = (): boolean => {
  try {
    const stored = globalThis.localStorage?.getItem('ozyra:ui:showThinking');
    return stored === null || stored === undefined ? true : stored === '1';
  } catch {
    return true;
  }
};

const ChatContainer: React.FC<ChatContainerProps> = ({
  currentChat,
  isDarkMode,
  isLoading,
  partialResponse,
  streamingComplete,
  selectedModel,
  editingMessageId,
  editingContent,
  copyToClipboard,
  startEditingMessage,
  saveMessageEdit,
  cancelMessageEdit,
  regenerateResponse,
  setEditingContent,
  availableModels,
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

  const lastAssistantId = useMemo(() => {
    const messages = currentChat?.messages ?? [];
    for (let index = messages.length - 1; index >= 0; index--) {
      if (messages[index].role === 'assistant') {
        return messages[index].id;
      }
    }
    return null;
  }, [currentChat?.messages]);

  const lastMessageId = useMemo(() => {
    const messages = currentChat?.messages ?? [];
    return messages.length > 0 ? messages[messages.length - 1].id : null;
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
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Selecciona o crea una conversación
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-8 pb-44">
      {!streamingComplete && (
        <div aria-live="polite" className="sr-only">
          {partialResponse || ''}
        </div>
      )}

      {currentChat.messages.map((message) => {
        const isStreamingAssistant =
          message.role !== 'user' && isLoading && message.id === lastAssistantId;

        return (
          <ChatMessageItem
            key={message.id}
            message={message}
            presentation={{
              isLatest: lastMessageId === message.id,
              isDarkMode,
              isLoading,
              isStreamingAssistant,
              isExpanded: expandedMessages.has(message.id),
              isCopied: copiedMessageId === message.id,
              showThinking,
              supportsReasoning: messageSupportsReasoning(message),
            }}
            editingMessageId={editingMessageId}
            editingContent={editingContent}
            availableModels={availableModels}
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
