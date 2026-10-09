import { Loader2, Sparkles } from 'lucide-react';
import type { ChatCustomizationController } from '../../../hooks/useChatCustomization';
import { t } from '../../../i18n';

interface ChatCustomizationPanelProps {
  readonly customization: ChatCustomizationController;
}

export const ChatCustomizationPanel = ({ customization }: ChatCustomizationPanelProps) => (
  <div className="mb-3 atelier-card p-4 animate-slide-up">
    <div className="mb-2.5 flex items-center justify-between">
      <h2 className="text-sm font-medium text-[var(--text-primary)]">{t('customizeThisChat')}</h2>
    </div>
    <div className="space-y-2.5">
      <p className="text-xs text-[var(--text-secondary)]">{t('customizeThisChatDesc')}</p>
      <textarea
        value={customization.draft}
        onChange={(e) => customization.setDraft(e.target.value)}
        placeholder={t('customizationPlaceholder')}
        aria-label={t('customizationInputLabel')}
        className="w-full p-3 rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-soft)] text-sm custom-scrollbar"
        rows={3}
      />
    </div>
    <div className="mt-3 flex items-center justify-between">
      <div>
        <button
          type="button"
          onClick={() => void customization.improve()}
          disabled={customization.isImproving}
          className="px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--color-secondary)] text-white hover:opacity-90 text-xs font-medium transition-opacity flex items-center gap-1.5"
          title={t('improveWithAi')}
        >
          {customization.isImproving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          <span>{t('improve')}</span>
        </button>
      </div>
      <div className="flex justify-end space-x-2">
        <button
          type="button"
          onClick={customization.close}
          className="px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-primary)] hover:bg-[var(--color-primary-soft)] text-[var(--text-primary)] text-xs font-medium transition-colors"
        >
          {t('panelCancel')}
        </button>
        <button
          type="button"
          onClick={() => void customization.save()}
          className="px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-[var(--bg-primary)] hover:shadow-[var(--shadow-glow)] text-xs font-medium transition-all"
        >
          {t('panelSave')}
        </button>
      </div>
    </div>
  </div>
);
