import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommandPalette } from './CommandPalette';

describe('CommandPalette', () => {
  it('filters and executes a matching command', () => {
    const onClose = vi.fn();
    const onExecuteCommand = vi.fn();

    render(
      <CommandPalette isOpen onClose={onClose} onExecuteCommand={onExecuteCommand} chats={[]} />
    );

    fireEvent.change(screen.getByLabelText('Buscar chats y comandos'), {
      target: { value: 'configuración' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Abrir configuración/ }));

    expect(onExecuteCommand).toHaveBeenCalledWith('settings');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not show disabled search commands', () => {
    render(<CommandPalette isOpen onClose={vi.fn()} onExecuteCommand={vi.fn()} chats={[]} />);

    fireEvent.change(screen.getByLabelText('Buscar chats y comandos'), {
      target: { value: 'búsqueda web' },
    });

    expect(screen.queryByText('Activar búsqueda web')).not.toBeInTheDocument();
  });
});
