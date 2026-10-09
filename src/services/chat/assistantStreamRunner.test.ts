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
  assistantMessageId: 'assistant-1',
  submittedModel: 'openai/gpt-5-chat',
  useWebSearch: false,
  directWebSearch: null,
  streamRequest: baseRequest,
  signal: new AbortController().signal,
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
      async (_request, { onChunk, onComplete, onAnnotations, onMetadata }) => {
        onChunk('Hola <thinking>plan</thinking>mundo');
        onAnnotations?.([
          {
            type: 'url_citation',
            url_citation: { url: 'https://stream.example', title: 'Stream' },
          },
        ]);
        onMetadata?.({
          finishReason: 'stop',
          usage: {
            promptTokens: 1200,
            completionTokens: 40,
            cachedTokens: 1024,
            cacheWriteTokens: 0,
            reasoningTokens: 10,
          },
        });
        onComplete();
      }
    );

    const onDraftUpdate = vi.fn();
    const { message, finishReason, usage } = await runAssistantStream(
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
    expect(finishReason).toBe('stop');
    expect(usage).toMatchObject({ promptTokens: 1200, cachedTokens: 1024 });
  });

  it('rejects with the error reported by the stream', async () => {
    vi.mocked(chatService.createChatCompletionStream).mockImplementation(
      async (_request, { onChunk, onError }) => {
        onChunk('parcial');
        onError(new Error('Proveedor caído'));
      }
    );

    await expect(runAssistantStream(createRunnerParams())).rejects.toThrow('Proveedor caído');
  });
});
