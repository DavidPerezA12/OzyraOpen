import { useEffect, useId, useRef } from 'react';
import { t } from '../../i18n';

export interface ConfirmOptions {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly danger?: boolean;
}

interface ConfirmDialogProps extends ConfirmOptions {
  readonly open: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * Diálogo de confirmación accesible basado en `<dialog>` nativo.
 *
 * - `role="alertdialog"` + `aria-modal` + labelledby/describedby.
 * - Escape y clic en el backdrop cancelan (nunca confirman).
 * - El foco inicial cae en "Cancelar" (botón seguro) y se restaura
 *   al elemento que abrió el diálogo al cerrarse.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<Element | null>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      previousFocusRef.current = typeof document !== 'undefined' ? document.activeElement : null;
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
      // Foco en el botón seguro para evitar confirmaciones accidentales con Enter.
      window.setTimeout(() => cancelButtonRef.current?.focus(), 0);
    }

    if (!open && dialog.open && typeof dialog.close === 'function') {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      const previous = previousFocusRef.current;
      if (previous instanceof HTMLElement) {
        previous.focus();
      }
      previousFocusRef.current = null;
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      className="confirm-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <div aria-hidden="true" className="confirm-dialog__backdrop" onClick={onCancel} />
      <div className="confirm-dialog__panel">
        <h2 id={titleId} className="confirm-dialog__title">
          {title}
        </h2>
        <p id={messageId} className="confirm-dialog__message">
          {message}
        </p>
        <div className="confirm-dialog__actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="confirm-dialog__button confirm-dialog__button--secondary"
            onClick={onCancel}
          >
            {cancelLabel ?? t('confirmCancel')}
          </button>
          <button
            type="button"
            className={`confirm-dialog__button ${
              danger ? 'confirm-dialog__button--danger' : 'confirm-dialog__button--primary'
            }`}
            onClick={onConfirm}
          >
            {confirmLabel ?? t('confirmDelete')}
          </button>
        </div>
      </div>
    </dialog>
  );
}
