import { useCallback, type Dispatch, type SetStateAction } from 'react';
import toast from 'react-hot-toast';
import type { Chat, Message } from '../types';
import { updateMessageContent } from '../utils/db';

interface UseMessageEditingParams {
  readonly currentChat: Chat | null;
  readonly setChats: Dispatch<SetStateAction<Chat[]>>;
  readonly setCurrentChat: Dispatch<SetStateAction<Chat | null>>;
  readonly editingContent: string;
  readonly setEditingMessageId: Dispatch<SetStateAction<string | null>>;
  readonly setEditingContent: Dispatch<SetStateAction<string>>;
}

export function useMessageEditing({
  currentChat,
  setChats,
  setCurrentChat,
  editingContent,
  setEditingMessageId,
  setEditingContent,
}: UseMessageEditingParams) {
  const startEditingMessage = useCallback(
    (message: Message) => {
      setEditingMessageId(message.id);
      setEditingContent(message.content);
    },
    [setEditingContent, setEditingMessageId]
  );

  const saveMessageEdit = useCallback(
    async (messageId: string) => {
      if (!currentChat) {
        return;
      }

      if (currentChat.isPersisted) {
        try {
          await updateMessageContent(messageId, editingContent);
        } catch (error) {
          console.error('Error al guardar edición en historial local:', error);
          toast.error('No se pudo guardar la edición en el historial local');
          return;
        }
      }

      const updatedMessages = currentChat.messages.map((message) =>
        message.id === messageId ? { ...message, content: editingContent } : message
      );
      const updatedChat = { ...currentChat, messages: updatedMessages };

      setCurrentChat(updatedChat);
      setChats((currentChats) =>
        currentChats.map((chat) => (chat.id === currentChat.id ? updatedChat : chat))
      );
      setEditingMessageId(null);
      setEditingContent('');
    },
    [currentChat, editingContent, setChats, setCurrentChat, setEditingContent, setEditingMessageId]
  );

  const cancelMessageEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditingContent('');
  }, [setEditingContent, setEditingMessageId]);

  return {
    startEditingMessage,
    saveMessageEdit,
    cancelMessageEdit,
  } as const;
}
