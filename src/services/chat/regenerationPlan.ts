import type { Chat, Message } from '../../types';
import { findPreviousUserMessageIndex } from '../../utils/messageOperations';

export interface RegenerationPlan {
  /** Mensaje de usuario que se vuelve a responder (se conserva tal cual) */
  readonly userMessage: Message;
  /** Chat truncado hasta ese mensaje inclusive */
  readonly updatedChat: Chat;
  readonly removedMessageIds: string[];
}

/**
 * Plan para volver a responder un mensaje de usuario.
 *
 * - `messageId` de un mensaje de usuario ("Reenviar"): se responde ese mensaje,
 *   incluso si es el último y aún no tiene respuesta (p. ej. tras un error).
 * - `messageId` de un asistente ("Regenerar"): se responde el mensaje de usuario
 *   que lo precede.
 * - Sin `messageId`: se regenera la última respuesta, que debe existir.
 */
export const buildRegenerationPlan = (chat: Chat, messageId?: string): RegenerationPlan | null => {
  const messages = [...chat.messages];
  const target = messageId ? messages.find((message) => message.id === messageId) : undefined;
  const isResendingUserMessage = target?.role === 'user';

  const userMessageIndex = isResendingUserMessage
    ? messages.indexOf(target)
    : findPreviousUserMessageIndex(messages, messageId);

  if (userMessageIndex === -1) {
    return null;
  }
  if (!isResendingUserMessage && userMessageIndex === messages.length - 1) {
    return null;
  }

  const userMessage = messages[userMessageIndex];
  if (!userMessage) {
    return null;
  }
  return {
    userMessage,
    updatedChat: { ...chat, messages: messages.slice(0, userMessageIndex + 1) },
    removedMessageIds: messages.slice(userMessageIndex + 1).map((message) => message.id),
  };
};
