import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Chat } from '../../types';
import { AdvancedSearch } from './AdvancedSearch';

const chats: Chat[] = [
  {
    id: 'chat-alpha',
    title: 'Proyecto Alpha',
    createdAt: 1_700_000_000_000,
    model: 'openai/test-model',
    messages: [
      {
        id: 'message-alpha',
        role: 'user',
        content: 'Plan del proyecto',
        timestamp: 1_700_000_000_001,
      },
    ],
  },
  {
    id: 'chat-beta',
    title: 'Notas Beta',
    createdAt: 1_600_000_000_000,
    model: 'openai/test-model',
    messages: [],
  },
];

describe('AdvancedSearch', () => {
  it('filters chats and selects the matching conversation', () => {
    const onSelectChat = vi.fn();

    render(
      <AdvancedSearch
        isOpen
        onClose={vi.fn()}
        chats={chats}
        favorites={new Set()}
        onSelectChat={onSelectChat}
        availableModels={['openai/test-model']}
      />
    );

    fireEvent.change(screen.getByLabelText('Buscar en conversaciones'), {
      target: { value: 'Alpha' },
    });

    expect(screen.getByText('1 resultados')).toBeInTheDocument();
    expect(screen.queryByText('Notas Beta')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Proyecto Alpha/ }));
    expect(onSelectChat).toHaveBeenCalledWith('chat-alpha');
  });
});
