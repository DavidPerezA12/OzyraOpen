/**
 * ThinkingContent Component
 *
 * Bloque plegable con el proceso de razonamiento de la IA:
 * - Cabecera clicable para expandir/contraer
 * - Contraído: solo cabecera, sin exponer contenido de razonamiento
 * - Expandido: el razonamiento completo renderizado como Markdown
 * - Estado de streaming en vivo y copiado integrado
 *
 * @component
 * @example
 * ```tsx
 * <ThinkingContent
 *   content={thinkingContent}
 *   isStreaming={isStreaming}
 *   copyToClipboard={copyToClipboard}
 * />
 * ```
 */

import { Brain, ChevronDown, Copy, Loader2 } from 'lucide-react';
import React, { Suspense, useState } from 'react';
import { t } from '../../i18n';

interface ThinkingContentProps {
  readonly content: string;
  readonly isStreaming?: boolean;
  readonly copyToClipboard: (text: string) => void;
}

// Mismo chunk diferido que el contenido de mensajes.
const RichMarkdown = React.lazy(() =>
  import('./RichMarkdown').then((module) => ({ default: module.RichMarkdown }))
);

export const ThinkingContent: React.FC<ThinkingContentProps> = ({
  content,
  isStreaming = false,
  copyToClipboard,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const trimmed = content.trim();

  return (
    <div className="thinking-block mb-3">
      <div className="thinking-header">
        <button
          type="button"
          className="thinking-toggle"
          onClick={() => setIsExpanded((v) => !v)}
          aria-expanded={isExpanded}
        >
          {isStreaming ? <Loader2 size={13} className="animate-spin" /> : <Brain size={13} />}
          <span>{isStreaming ? t('reasoningStreaming') : t('reasoningTitle')}</span>
        </button>

        {!isStreaming && trimmed && (
          <button
            type="button"
            className="thinking-icon-btn"
            onClick={() => copyToClipboard(content)}
            title={t('copyReasoning')}
            aria-label={t('copyReasoning')}
          >
            <Copy size={13} />
          </button>
        )}

        <button
          type="button"
          className="thinking-icon-btn"
          onClick={() => setIsExpanded((v) => !v)}
          title={isExpanded ? t('collapseAction') : t('expandAction')}
          aria-label={isExpanded ? t('collapseReasoning') : t('expandReasoning')}
          aria-expanded={isExpanded}
        >
          <ChevronDown
            size={14}
            className={`thinking-chevron ${isExpanded ? 'thinking-chevron--open' : ''}`}
          />
        </button>
      </div>

      {isExpanded && (
        <div className="thinking-body custom-scrollbar">
          {isStreaming ? (
            <div className="whitespace-pre-wrap">{content}</div>
          ) : (
            <Suspense fallback={<div className="whitespace-pre-wrap">{content}</div>}>
              <RichMarkdown content={content} copyToClipboard={copyToClipboard} />
            </Suspense>
          )}
        </div>
      )}
    </div>
  );
};
