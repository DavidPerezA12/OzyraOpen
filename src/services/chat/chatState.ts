import type { Chat, Message } from '../../types';

export const createLocalChat = (selectedModel: string): Chat => ({
  id: crypto.randomUUID(),
  title: 'Nueva Conversación',
  messages: [],
  createdAt: Date.now(),
  model: selectedModel,
  isPersisted: false,
  isPinned: false,
});

export const updateMessageInChat = (
  chat: Chat,
  messageId: string,
  update: (message: Message) => Message
): Chat => ({
  ...chat,
  messages: chat.messages.map((message) => (message.id === messageId ? update(message) : message)),
});

export const upsertChat = (chats: Chat[], updatedChat: Chat): Chat[] => {
  const exists = chats.some((chat) => chat.id === updatedChat.id);
  if (exists) {
    return chats.map((chat) => (chat.id === updatedChat.id ? updatedChat : chat));
  }
  return [updatedChat, ...chats.filter((chat) => chat.id !== updatedChat.id)];
};
