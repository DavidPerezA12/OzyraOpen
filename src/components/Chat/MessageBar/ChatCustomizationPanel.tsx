import { Loader2, Sparkles } from 'lucide-react';
import { t } from '../../../i18n';

interface ChatCustomizationPanelProps {
  readonly value: string;
  readonly setValue: (input: string) => void;
  readonly setShowChatCustomization: (show: boolean) => void;
  readonly handleSaveChatCustomization: () => void;
  readonly handleImproveChatCustomization: () => void;
  readonly isImprovingChatCustomization: boolean;
}

export const ChatCustomizationPanel = ({
  value,
  setValue,
  setShowChatCustomization,
  handleSaveChatCustomization,
  handleImproveChatCustomization,
  isImprovingChatCustomization,
}: ChatCustomizationPanelProps) => (
  <div className="mb-3 atelier-card p-4 animate-slide-up">
    <div className="mb-2.5 flex items-center justify-between">
      <h2 className="text-sm font-medium text-[var(--text-primary)]">{t('customizeThisChat')}</h2>
    </div>
    <div className="space-y-2.5">
      <p className="text-xs text-[var(--text-secondary)]">{t('customizeThisChatDesc')}</p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
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
          onClick={handleImproveChatCustomization}
          disabled={isImprovingChatCustomization}
          className="px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--color-secondary)] text-white hover:opacity-90 text-xs font-medium transition-opacity flex items-center gap-1.5"
          title={t('improveWithAi')}
        >
          {isImprovingChatCustomization ? (
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
          onClick={() => setShowChatCustomization(false)}
          className="px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-primary)] hover:bg-[var(--color-primary-soft)] text-[var(--text-primary)] text-xs font-medium transition-colors"
        >
          {t('panelCancel')}
        </button>
        <button
          type="button"
          onClick={handleSaveChatCustomization}
          className="px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-[var(--bg-primary)] hover:shadow-[var(--shadow-glow)] text-xs font-medium transition-all"
        >
          {t('panelSave')}
        </button>
      </div>
    </div>
  </div>
);
