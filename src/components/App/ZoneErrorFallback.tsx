import { t } from '../../i18n';

/**
 * Fallback compacto para boundaries por zona.
 *
 * A diferencia del fallback global (recarga completa), aquí basta con
 * remontar el subárbol: borradores, historial y ajustes viven fuera del
 * boundary y se conservan.
 */
export function ZoneErrorFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-sm font-medium text-[var(--text-primary)]">{t('errorBoundaryTitle')}</p>
      <p className="max-w-sm text-xs text-[var(--text-secondary)]">{t('errorBoundaryBody')}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 rounded-[var(--radius-md)] border border-[var(--border-strong)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
      >
        {t('errorBoundaryRetry')}
      </button>
    </div>
  );
}
