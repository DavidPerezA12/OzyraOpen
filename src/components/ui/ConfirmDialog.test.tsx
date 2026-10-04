import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';
import { useConfirm } from '../../hooks/useConfirm';
import { t } from '../../i18n';

function Harness({ onResult }: { onResult: (value: boolean) => void }) {
  const { confirm, confirmDialog } = useConfirm();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void confirm({ title: 'Borrar', message: '¿Seguro?' }).then(onResult);
        }}
      >
        abrir
      </button>
      {confirmDialog}
    </>
  );
}

describe('ConfirmDialog', () => {
  it('confirma con el botón de eliminar', async () => {
    const results: boolean[] = [];
    render(<Harness onResult={(value) => results.push(value)} />);

    fireEvent.click(screen.getByRole('button', { name: 'abrir' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    fireEvent.click(screen.getByRole('button', { name: t('confirmDelete') }));
    await waitFor(() => expect(results).toEqual([true]));
  });

  it('cancela con Escape sin confirmar', async () => {
    const results: boolean[] = [];
    render(<Harness onResult={(value) => results.push(value)} />);

    fireEvent.click(screen.getByRole('button', { name: 'abrir' }));
    const dialog = await screen.findByRole('alertdialog');

    // jsdom no implementa showModal/cancel nativo: despachar el evento cancel.
    dialog.dispatchEvent(new Event('cancel', { bubbles: false, cancelable: true }));
    await waitFor(() => expect(results).toEqual([false]));
  });

  it('renderiza título y mensaje accesibles por nombre', () => {
    render(
      <ConfirmDialog
        open
        title="Eliminar conversación"
        message="Esta acción no se puede deshacer."
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />
    );

    const dialog = screen.getByRole('alertdialog', { name: 'Eliminar conversación' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Esta acción no se puede deshacer.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('confirmCancel') })).toBeInTheDocument();
  });
});
