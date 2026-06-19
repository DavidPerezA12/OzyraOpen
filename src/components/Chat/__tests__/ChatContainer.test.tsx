import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as modelsModule from '../../../config/models';
import ChatContainer from '../ChatContainer';
import type { Chat, Message, ModelCapabilities, ModelInfo } from '../../../types';

const baseCapabilities: ModelCapabilities = {
  fast: false,
  vision: false,
  reasoning: false,
  effortControl: false,
  toolCalling: false,
  imageGeneration: false,
  pdfComprehension: false,
  thinking: false,
  images: false,
  files: false,
  webSearch: false,
  tools: false,
  reasoningLevels: false,
};

const defaultModel: ModelInfo = {
  id: 'model-1',
  name: 'Model One',
  icon: 'div',
  provider: 'openrouter',
  displayProviderName: 'OpenRoutes',
  tier: 'standard',
  description: 'Test model',
  capabilities: baseCapabilities,
};

const createChat = (messages: Message[]): Chat => ({
  id: 'chat-1',
  title: 'Chat 1',
  messages,
  createdAt: Date.now(),
  model: defaultModel.id,
});

const createHandlers = () => ({
  copyToClipboard: vi.fn(),
  startEditingMessage: vi.fn(),
  saveMessageEdit: vi.fn(),
  cancelMessageEdit: vi.fn(),
  regenerateResponse: vi.fn(),
  setEditingContent: vi.fn(),
});

describe('ChatContainer', () => {
  const modelHasCapabilitySpy = vi.spyOn(modelsModule, 'modelHasCapability');

  beforeEach(() => {
    modelHasCapabilitySpy.mockReset();
    modelHasCapabilitySpy.mockReturnValue(false);
  });

  it('renders user and assistant messages', () => {
    const chat = createChat([
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hola desde el usuario',
        timestamp: Date.now(),
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Respuesta del asistente',
        timestamp: Date.now() + 1,
      },
    ]);

    const handlers = createHandlers();

    render(
      <ChatContainer
        currentChat={chat}
        isDarkMode={false}
        isLoading={false}
        partialResponse={null}
        streamingComplete={true}
        selectedModel={defaultModel.id}
        editingMessageId={null}
        editingContent=""
        availableModels={[defaultModel]}
        {...handlers}
      />
    );

    expect(screen.getByText('Hola desde el usuario')).toBeInTheDocument();
    expect(screen.getByText('Respuesta del asistente')).toBeInTheDocument();
  });

  it('renders persisted image attachments from base64 data instead of stale blob URLs', () => {
    const chat = createChat([
      {
        id: 'msg-1',
        role: 'user',
        content: 'Imagen adjunta',
        timestamp: Date.now(),
        attachments: [
          {
            type: 'image',
            name: 'image.png',
            url: 'blob:stale-preview',
            contentType: 'image/png',
            data: 'abc123',
          },
        ],
      },
    ]);

    const handlers = createHandlers();

    render(
      <ChatContainer
        currentChat={chat}
        isDarkMode={false}
        isLoading={false}
        partialResponse={null}
        streamingComplete={true}
        selectedModel={defaultModel.id}
        editingMessageId={null}
        editingContent=""
        availableModels={[defaultModel]}
        {...handlers}
      />
    );

    expect(screen.getByRole('img', { name: 'Imagen adjunta 1' })).toHaveAttribute(
      'src',
      'data:image/png;base64,abc123'
    );
  });

  it('exposes streaming content for screen readers while generation is in progress', () => {
    const chat = createChat([
      {
        id: 'msg-1',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      },
    ]);

    const handlers = createHandlers();

    render(
      <ChatContainer
        currentChat={chat}
        isDarkMode={false}
        isLoading={true}
        partialResponse="Generando respuesta..."
        streamingComplete={false}
        selectedModel={defaultModel.id}
        editingMessageId={null}
        editingContent=""
        availableModels={[defaultModel]}
        {...handlers}
      />
    );

    expect(screen.getByText('Generando respuesta...')).toBeInTheDocument();
  });

  it('renders reasoning block when model supports reasoning and message provides thinking content', () => {
    modelHasCapabilitySpy.mockImplementation(
      (_modelId: string, capability: keyof ModelCapabilities) =>
        capability === 'reasoning' || capability === 'thinking'
    );

    const chat = createChat([
      {
        id: 'msg-1',
        role: 'assistant',
        content: 'Respuesta parcial',
        timestamp: Date.now(),
        thinkingContent: 'Pensamiento intermedio',
      },
    ]);

    const handlers = createHandlers();

    render(
      <ChatContainer
        currentChat={chat}
        isDarkMode={false}
        isLoading={true}
        partialResponse={null}
        streamingComplete={false}
        selectedModel={defaultModel.id}
        editingMessageId={null}
        editingContent=""
        availableModels={[defaultModel]}
        {...handlers}
      />
    );

    expect(screen.getByText(/Razonando…|Razonamiento/)).toBeInTheDocument();
    expect(screen.queryByText('Pensamiento intermedio')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expandir razonamiento' }));

    expect(screen.getByText('Pensamiento intermedio')).toBeInTheDocument();
  });

  it('uses the message model, not the currently selected model, to show stored reasoning', () => {
    modelHasCapabilitySpy.mockImplementation(
      (modelId: string, capability: keyof ModelCapabilities) =>
        modelId === 'reasoning-model:online' &&
        (capability === 'reasoning' || capability === 'thinking')
    );

    const chat = createChat([
      {
        id: 'msg-1',
        role: 'assistant',
        content: 'Respuesta guardada',
        timestamp: Date.now(),
        model: 'reasoning-model:online',
        thinkingContent: 'Razonamiento guardado',
      },
    ]);

    const handlers = createHandlers();

    render(
      <ChatContainer
        currentChat={chat}
        isDarkMode={false}
        isLoading={false}
        partialResponse={null}
        streamingComplete={true}
        selectedModel="plain-model"
        editingMessageId={null}
        editingContent=""
        availableModels={[defaultModel]}
        {...handlers}
      />
    );

    expect(screen.queryByText('Razonamiento guardado')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expandir razonamiento' }));

    expect(screen.getByText('Razonamiento guardado')).toBeInTheDocument();
    expect(modelHasCapabilitySpy).toHaveBeenCalledWith('reasoning-model:online', 'reasoning');
  });

  it('shows immediate feedback when copying an assistant message', () => {
    const chat = createChat([
      {
        id: 'msg-1',
        role: 'assistant',
        content: 'Respuesta para copiar',
        timestamp: Date.now(),
      },
    ]);

    const handlers = createHandlers();

    render(
      <ChatContainer
        currentChat={chat}
        isDarkMode={false}
        isLoading={false}
        partialResponse={null}
        streamingComplete={true}
        selectedModel={defaultModel.id}
        editingMessageId={null}
        editingContent=""
        availableModels={[defaultModel]}
        {...handlers}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copiar respuesta' }));

    expect(handlers.copyToClipboard).toHaveBeenCalledWith('Respuesta para copiar');
    expect(screen.getByRole('button', { name: 'Respuesta copiada' })).toBeInTheDocument();
  });
});
