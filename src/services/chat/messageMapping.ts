import type { ChatMessage } from '../openrouter/types';

type OpenRouterMessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | {
          type: 'image_url';
          image_url: { url: string };
        }
    >;

type OpenRouterMessage = Omit<ChatMessage, 'images' | 'content'> & {
  content: OpenRouterMessageContent;
};

export function mapMessageForOpenRouter(message: ChatMessage): ChatMessage | OpenRouterMessage {
  if (!message.images?.length) {
    return message;
  }

  return {
    role: message.role,
    content: [
      { type: 'text', text: message.content },
      ...message.images.map((image) => ({
        type: 'image_url' as const,
        image_url: {
          url: image.data ? `data:${image.contentType};base64,${image.data}` : image.url,
        },
      })),
    ],
  };
}
