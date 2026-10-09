import type { Chat, Message } from '../../types';
import {
  createChat as createChatDb,
  createMessage,
  updateChatTitle as updateChatTitleDb,
} from '../../utils/db';
import { toChatRecord, toMessageRecord } from './chatRecords';

/** Crea el registro del chat la primera vez que se envía un mensaje. */
export async function persistChatIfNeeded(chat: Chat): Promise<Chat> {
  if (chat.isPersisted) {
    return chat;
  }
  await createChatDb(toChatRecord(chat));
  return { ...chat, isPersisted: true };
}

export async function saveMessageToLocalHistory(
  message: Message,
  chatId: string
): Promise<'saved' | 'empty'> {
  if (!message.content.trim() && !message.attachments?.length) {
    return 'empty';
  }
  await createMessage(toMessageRecord(message, chatId));
  return 'saved';
}

export async function saveGeneratedTitleToLocalHistory(
  chatId: string,
  title: string
): Promise<void> {
  await updateChatTitleDb(chatId, title);
}
