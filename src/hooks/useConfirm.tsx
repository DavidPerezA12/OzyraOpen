import { useCallback, useState } from 'react';
import { ConfirmDialog, type ConfirmOptions } from '../components/ui/ConfirmDialog';

type PendingConfirm = ConfirmOptions & { readonly resolve: (value: boolean) => void };

/**
 * Hook que expone `confirm(options): Promise<boolean>`.
 *
 * Sustituye a `window.confirm`: no bloquea el hilo principal, respeta el
 * idioma de la app, es testeable (mockeando el hook) y accesible.
 * Renderiza `{confirmDialog}` una vez junto al resto de overlays.
 */
export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    setPending((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  const handleConfirm = useCallback(() => settle(true), [settle]);
  const handleCancel = useCallback(() => settle(false), [settle]);

  const confirmDialog = pending ? (
    <ConfirmDialog
      open
      title={pending.title}
      message={pending.message}
      confirmLabel={pending.confirmLabel}
      cancelLabel={pending.cancelLabel}
      danger={pending.danger}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return { confirm, confirmDialog };
}
