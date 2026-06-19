/**
 * Utilidades para migración de chats locales a base de datos
 */

import type { Chat as ChatType } from '../types';
import { DEFAULT_MODEL_ID } from '../config/models';
import {
  createChat as createChatDb,
  createMessage,
  getChats as getChatsDb,
  getMessages as getMessagesDb,
} from './db';

const toCreatedAtIso = (createdAt: number | undefined): string | undefined => {
  if (!createdAt || Number.isNaN(createdAt)) {
    return undefined;
  }

  return new Date(createdAt).toISOString();
};

/**
 * Migra/reconcilia chats guardados en localStorage a la base local actual.
 */
export async function migrateLocalChatsToDatabase(
  userId: string,
  localChats: ChatType[]
): Promise<{ success: boolean; migratedCount: number }> {
  const migrationKey = `migrated_chats_${userId}`;
  const alreadyMigrated = localStorage.getItem(migrationKey);
  const existingChats = await getChatsDb(userId);
  const existingChatIds = new Set(existingChats.map((chat) => chat.id));

  if (alreadyMigrated && localChats.every((chat) => existingChatIds.has(chat.id))) {
    console.info('[Migration] Chats already reconciled for this user, skipping');
    localStorage.removeItem('chats');
    return { success: true, migratedCount: 0 };
  }

  if (localChats.length === 0) {
    localStorage.setItem(migrationKey, 'true');
    localStorage.removeItem('chats');
    return { success: true, migratedCount: 0 };
  }

  console.info(`[Migration] Reconciling ${localChats.length} local chats`);
  const claimedChatIds = new Set(existingChatIds);
  const migrationResults = await Promise.all(
    localChats.map(async (chat) => {
      const shouldCreateChat = !claimedChatIds.has(chat.id);
      claimedChatIds.add(chat.id);
      let migratedCount = 0;
      let failed = false;

      try {
        if (shouldCreateChat) {
          await createChatDb({
            id: chat.id,
            title: chat.title,
            user_id: userId,
            model: chat.model || DEFAULT_MODEL_ID,
            customization_prompt: chat.customizationPrompt ?? undefined,
            is_pinned: chat.isPinned || false,
            created_at: toCreatedAtIso(chat.createdAt),
          });
          migratedCount = 1;
        }

        const existingMessages = await getMessagesDb(chat.id);
        const existingMessageIds = new Set(existingMessages.map((message) => message.id));

        await Promise.all(
          chat.messages.map(async (message) => {
            const messageId =
              message.id && message.id.trim() !== '' ? message.id : crypto.randomUUID();

            if (existingMessageIds.has(messageId)) {
              console.info(`[Migration] Skipping existing message: ${messageId}`);
              return;
            }

            try {
              await createMessage({
                id: messageId,
                chat_id: chat.id,
                role:
                  message.role === 'assistant' || message.role === 'user'
                    ? message.role
                    : 'assistant',
                content: message.content,
                timestamp: message.timestamp,
                model: message.model,
                thinking_content: message.thinkingContent,
                use_web_search: message.useWebSearch,
                search_queries: message.searchQueries,
                annotations: message.annotations,
                attachments: message.attachments,
                user_id: userId,
              });
              console.info(`[Migration] Reconciled message: ${messageId}`);
            } catch (messageError: unknown) {
              failed = true;
              console.error('Error migrando mensaje local:', messageError);
            }
          })
        );

        console.info(`[Migration] Successfully reconciled chat: ${chat.id}`);
      } catch (chatError: unknown) {
        failed = true;
        console.error('Error migrando chat local:', chatError);
      }

      return { migratedCount, failed };
    })
  );
  const migratedCount = migrationResults.reduce((total, result) => total + result.migratedCount, 0);
  const hasFailures = migrationResults.some((result) => result.failed);

  if (hasFailures) {
    console.warn('[Migration] Migration finished with errors; keeping legacy chats for retry');
    return { success: false, migratedCount };
  }

  // Mark migration as completed
  localStorage.setItem(migrationKey, 'true');
  localStorage.removeItem('chats');
  console.info('[Migration] Migration completed successfully');

  return { success: true, migratedCount };
}

/**
 * Carga chats desde la base de datos
 */
export async function loadChatsFromDatabase(userId: string): Promise<ChatType[]> {
  const chatRecords = await getChatsDb(userId);

  const loadedChats = await Promise.all(
    chatRecords.map(async (chatRec) => {
      const msgRecs = await getMessagesDb(chatRec.id);
      const messages = msgRecs.map((mr) => ({
        id: mr.id,
        role: mr.role,
        content: mr.content,
        timestamp: new Date(mr.timestamp).getTime(),
        model: mr.model || DEFAULT_MODEL_ID,
        thinkingContent: mr.thinking_content,
        useWebSearch: mr.use_web_search,
        searchQueries: mr.search_queries,
        annotations: mr.annotations,
        attachments: mr.attachments,
      }));

      return {
        id: chatRec.id,
        title: chatRec.title,
        messages,
        createdAt: new Date(chatRec.created_at).getTime(),
        model: chatRec.model || DEFAULT_MODEL_ID,
        isPersisted: true,
        isPinned: chatRec.is_pinned || false,
        customizationPrompt: chatRec.customization_prompt || undefined,
      };
    })
  );

  return loadedChats;
}
