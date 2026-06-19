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
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createMarkdownComponents } from './MarkdownComponents';

interface ThinkingContentProps {
  readonly content: string;
  readonly isStreaming?: boolean;
  readonly copyToClipboard: (text: string) => void;
}

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
          <span>{isStreaming ? 'Razonando…' : 'Razonamiento'}</span>
        </button>

        {!isStreaming && trimmed && (
          <button
            type="button"
            className="thinking-icon-btn"
            onClick={() => copyToClipboard(content)}
            title="Copiar razonamiento"
            aria-label="Copiar razonamiento"
          >
            <Copy size={13} />
          </button>
        )}

        <button
          type="button"
          className="thinking-icon-btn"
          onClick={() => setIsExpanded((v) => !v)}
          title={isExpanded ? 'Contraer' : 'Expandir'}
          aria-label={isExpanded ? 'Contraer razonamiento' : 'Expandir razonamiento'}
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
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={createMarkdownComponents(copyToClipboard)}
          >
            {content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};
