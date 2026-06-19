import { mapMessageForOpenRouter } from '../chat/messageMapping';
import type { ChatCompletionRequest } from './types';

export function buildOpenRouterPayload(request: ChatCompletionRequest): Record<string, unknown> {
  return {
    ...request,
    messages: request.messages.map(mapMessageForOpenRouter),
  };
}
