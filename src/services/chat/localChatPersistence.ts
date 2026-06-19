import type { Chat, Message } from '../../types';
import {
  createChat as createChatDb,
  createMessage,
  updateChatTitle as updateChatTitleDb,
  type ChatRecord,
} from '../../utils/db';
import { buildAssistantMessageRecord, buildUserMessageRecord } from './generationPipeline';

export async function persistChatIfNeeded({
  chat,
  userId,
}: {
  readonly chat: Chat;
  readonly userId: string | null;
}): Promise<Chat> {
  if (!userId || chat.isPersisted) {
    return chat;
  }

  const newChatRecord: Omit<ChatRecord, 'created_at'> = {
    id: chat.id,
    title: chat.title,
    user_id: userId,
    model: chat.model,
    customization_prompt: chat.customizationPrompt ?? undefined,
  };
  await createChatDb(newChatRecord);

  return { ...chat, isPersisted: true };
}

export async function saveUserMessageToLocalHistory({
  message,
  chatId,
  userId,
}: {
  readonly message: Message;
  readonly chatId: string;
  readonly userId: string | null;
}): Promise<void> {
  if (!userId) {
    return;
  }

  await createMessage(
    buildUserMessageRecord({
      message,
      chatId,
      userId,
    })
  );
}

export async function saveAssistantMessageToLocalHistory({
  message,
  chatId,
  userId,
}: {
  readonly message: Message;
  readonly chatId: string;
  readonly userId: string | null;
}): Promise<'saved' | 'skipped' | 'empty'> {
  if (!userId) {
    return 'skipped';
  }

  if (!message.content.trim()) {
    return 'empty';
  }

  await createMessage(
    buildAssistantMessageRecord({
      message,
      chatId,
      userId,
    })
  );
  return 'saved';
}

export async function saveGeneratedTitleToLocalHistory({
  chatId,
  title,
  userId,
}: {
  readonly chatId: string;
  readonly title: string;
  readonly userId: string | null;
}): Promise<void> {
  if (!userId) {
    return;
  }

  await updateChatTitleDb(chatId, title);
}
