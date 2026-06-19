import type { Chat, Message, UploadedImage } from '../../types';
import { findPreviousUserMessageIndex } from '../../utils/messageOperations';

const getImageAttachmentsForResubmit = (message: Message): UploadedImage[] =>
  message.attachments?.flatMap((attachment) =>
    attachment.type === 'image'
      ? [
          {
            url: attachment.url,
            contentType: attachment.contentType ?? 'image/png',
            data: attachment.data,
          },
        ]
      : []
  ) ?? [];

export interface RegenerationPlan {
  readonly userMessage: Message;
  readonly updatedChat: Chat;
  readonly removedMessageIds: string[];
  readonly attachmentsOverride: UploadedImage[];
}

export const buildRegenerationPlan = (chat: Chat, messageId?: string): RegenerationPlan | null => {
  const messages = [...chat.messages];
  const userMessageIndex = findPreviousUserMessageIndex(messages, messageId);

  if (userMessageIndex === -1 || userMessageIndex === messages.length - 1) {
    return null;
  }

  const userMessage = messages[userMessageIndex];
  return {
    userMessage,
    updatedChat: { ...chat, messages: messages.slice(0, userMessageIndex + 1) },
    removedMessageIds: messages.slice(userMessageIndex + 1).map((message) => message.id),
    attachmentsOverride: getImageAttachmentsForResubmit(userMessage),
  };
};
