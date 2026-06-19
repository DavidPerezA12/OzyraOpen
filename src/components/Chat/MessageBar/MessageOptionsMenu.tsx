import { useState, useRef, useEffect } from 'react';
import { Zap, ChevronDown, Check, Globe } from 'lucide-react';
import type { ReasoningLevel } from './types';

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
    title={isWebSearchEnabled ? 'Búsqueda web activada' : 'Buscar en la web'}
    aria-label={isWebSearchEnabled ? 'Búsqueda web activada' : 'Buscar en la web'}
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
  readonly label: string;
  readonly title: string;
}> = [
  { value: 'low', label: 'Instant', title: 'Razonamiento instantáneo' },
  { value: 'medium', label: 'Smart', title: 'Razonamiento inteligente' },
  { value: 'high', label: 'Max', title: 'Razonamiento máximo' },
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
        className={`composer-tool-btn ${isOpen ? 'active' : ''}`}
        title="Nivel de razonamiento del modelo"
        disabled={isLoading}
      >
        <Zap size={14} className="opacity-70" />
        <span>{activeLevel.label}</span>
        <ChevronDown
          size={12}
          className={`opacity-50 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="reasoning-dropdown-menu focus:outline-none">
          {REASONING_LEVELS.map((level) => {
            const isSelected = reasoningLevel === level.value;
            return (
              <button
                key={level.value}
                type="button"
                onClick={() => {
                  setReasoningLevel(level.value);
                  setIsOpen(false);
                }}
                className={`flex items-center justify-between w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--bg-hover)] cursor-pointer ${
                  isSelected
                    ? 'text-[var(--text-primary)] font-semibold'
                    : 'text-[var(--text-secondary)]'
                }`}
                title={level.title}
              >
                <span>{level.label}</span>
                {isSelected && <Check size={12} className="text-[var(--accent)]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
