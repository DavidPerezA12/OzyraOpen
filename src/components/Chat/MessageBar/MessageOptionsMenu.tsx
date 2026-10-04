import { useState, useRef, useEffect } from 'react';
import { Zap, ChevronDown, Check, Globe } from 'lucide-react';
import type { ReasoningLevel } from './types';
import { t, type TranslationKey } from '../../../i18n';

interface WebSearchToggleProps {
  readonly isLoading: boolean;
  readonly isWebSearchEnabled: boolean;
  readonly onToggleWebSearch: () => void;
}

export const WebSearchToggle = ({
  isLoading,
  isWebSearchEnabled,
  onToggleWebSearch,
}: WebSearchToggleProps) => (
  <button
    type="button"
    onClick={() => {
      if (!isLoading) {
        onToggleWebSearch();
      }
    }}
    className={`composer-icon-btn ${isWebSearchEnabled ? 'active' : ''} ${isLoading ? 'is-disabled' : ''}`}
    title={isWebSearchEnabled ? t('webSearchEnabled') : t('webSearchToggle')}
    aria-label={isWebSearchEnabled ? t('webSearchEnabled') : t('webSearchToggle')}
    aria-pressed={isWebSearchEnabled}
    aria-disabled={isLoading}
  >
    <Globe size={15} />
  </button>
);

interface ReasoningLevelSelectorProps {
  readonly isLoading: boolean;
  readonly reasoningLevel: ReasoningLevel;
  readonly setReasoningLevel: (level: ReasoningLevel) => void;
}

const REASONING_LEVELS: Array<{
  readonly value: ReasoningLevel;
  readonly labelKey: TranslationKey;
  readonly titleKey: TranslationKey;
}> = [
  { value: 'low', labelKey: 'reasoningLevelLow', titleKey: 'reasoningInstant' },
  { value: 'medium', labelKey: 'reasoningLevelMedium', titleKey: 'reasoningSmart' },
  { value: 'high', labelKey: 'reasoningLevelHigh', titleKey: 'reasoningMax' },
];

export const ReasoningLevelSelector = ({
  isLoading,
  reasoningLevel,
  setReasoningLevel,
}: ReasoningLevelSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeLevel =
    REASONING_LEVELS.find((l) => l.value === reasoningLevel) || REASONING_LEVELS[1];

  if (!activeLevel) {
    return null;
  }

  const closeMenu = () => setIsOpen(false);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (!isLoading) {
            setIsOpen(!isOpen);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && isOpen) {
            e.stopPropagation();
            closeMenu();
          }
        }}
        className={`composer-tool-btn ${isOpen ? 'active' : ''}`}
        title={t('reasoningLevelTitle')}
        aria-label={t('reasoningLevelTitle')}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        disabled={isLoading}
      >
        <Zap size={14} className="opacity-70" />
        <span>{t(activeLevel.labelKey)}</span>
        <ChevronDown
          size={12}
          className={`opacity-50 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          className="reasoning-dropdown-menu focus:outline-none"
          role="menu"
          aria-label={t('reasoningLevelTitle')}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              closeMenu();
            }
          }}
        >
          {REASONING_LEVELS.map((level) => {
            const isSelected = reasoningLevel === level.value;
            return (
              <button
                key={level.value}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                onClick={() => {
                  setReasoningLevel(level.value);
                  setIsOpen(false);
                }}
                className={`flex items-center justify-between w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--bg-hover)] cursor-pointer ${
                  isSelected
                    ? 'text-[var(--text-primary)] font-semibold'
                    : 'text-[var(--text-secondary)]'
                }`}
                title={t(level.titleKey)}
              >
                <span>{t(level.labelKey)}</span>
                {isSelected && <Check size={12} className="text-[var(--accent)]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
