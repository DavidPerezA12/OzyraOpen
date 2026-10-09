import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { t } from '../i18n';
import type { ChatStore } from '../state/chatStore';
import type { Message } from '../types';
import { updateMessageContent } from '../utils/db';
import { logger } from '../utils/logger';

/** Edición en línea de mensajes del chat activo. */
export function useMessageEditing(store: ChatStore) {
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const startEditingMessage = useCallback((message: Message) => {
    setEditingMessageId(message.id);
    setEditingContent(message.content);
  }, []);

  const cancelMessageEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditingContent('');
  }, []);

  const saveMessageEdit = useCallback(
    async (messageId: string) => {
      const chat = store.getCurrentChat();
      if (!chat) {
        return;
      }

      if (chat.isPersisted) {
        try {
          await updateMessageContent(messageId, editingContent);
        } catch (error) {
          logger.error('Error al guardar edición en historial local:', error);
          toast.error(t('editSaveError'));
          return;
        }
      }

      store.updateChat(chat.id, (current) => ({
        ...current,
        messages: current.messages.map((message) =>
          message.id === messageId ? { ...message, content: editingContent } : message
        ),
      }));
      cancelMessageEdit();
    },
    [cancelMessageEdit, editingContent, store]
  );

  return {
    editingMessageId,
    editingContent,
    setEditingContent,
    startEditingMessage,
    saveMessageEdit,
    cancelMessageEdit,
  } as const;
}
