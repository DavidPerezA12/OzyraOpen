import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chatService, type ChatCompletionRequest } from '../chatService';
import { runAssistantStream, type RunAssistantStreamParams } from './assistantStreamRunner';

vi.mock('../chatService', () => ({
  chatService: {
    createChatCompletionStream: vi.fn(),
  },
}));

const baseRequest: ChatCompletionRequest = {
  model: 'openai/gpt-5-chat',
  messages: [{ role: 'user', content: 'Hola' }],
  temperature: 0.7,
  max_tokens: 2048,
};

const createRunnerParams = (
  overrides: Partial<RunAssistantStreamParams> = {}
): RunAssistantStreamParams => ({
  chatId: 'chat-1',
  assistantMessageId: 'assistant-1',
  submittedModel: 'openai/gpt-5-chat',
  useWebSearch: false,
  directWebSearch: null,
  streamRequest: baseRequest,
  controller: new AbortController(),
  activeFlushTimersRef: { current: {} },
  activeStreamRunIdsRef: { current: {} },
  onDraftUpdate: vi.fn(),
  ...overrides,
});

describe('runAssistantStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: vi.fn((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      }),
    });
  });

  it('streams visible text, thinking content and annotations into a final assistant message', async () => {
    vi.mocked(chatService.createChatCompletionStream).mockImplementation(
      async (_request, onChunk, onComplete, _onError, onAnnotations) => {
        onChunk('Hola <thinking>plan</thinking>mundo');
        onAnnotations?.([
          {
            type: 'url_citation',
            url_citation: { url: 'https://stream.example', title: 'Stream' },
          },
        ]);
        onComplete();
      }
    );

    const onDraftUpdate = vi.fn();
    const message = await runAssistantStream(
      createRunnerParams({
        useWebSearch: true,
        directWebSearch: {
          provider: 'tavily',
          query: 'consulta',
          results: [],
          annotations: [
            {
              type: 'url_citation',
              url_citation: { url: 'https://direct.example', title: 'Direct' },
            },
          ],
        },
        onDraftUpdate,
      })
    );

    expect(onDraftUpdate).toHaveBeenCalledWith({
      partialResponse: 'Hola mundo',
      thinkingProcessContent: 'plan',
    });
    expect(message).toMatchObject({
      id: 'assistant-1',
      role: 'assistant',
      content: 'Hola mundo',
      thinkingContent: 'plan',
      useWebSearch: true,
      searchQueries: ['consulta'],
    });
    expect(message.annotations?.map((annotation) => annotation.url_citation.url)).toEqual([
      'https://direct.example',
      'https://stream.example',
    ]);
  });
});
