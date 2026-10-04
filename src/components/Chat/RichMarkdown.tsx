import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createMarkdownComponents } from './MarkdownComponents';

const REMARK_PLUGINS = [remarkGfm];

interface RichMarkdownProps {
  readonly content: string;
  readonly copyToClipboard: (text: string) => void;
}

/**
 * Renderizado Markdown completo (GFM + resaltado de sintaxis).
 *
 * Este módulo arrastra `react-markdown`, `react-syntax-highlighter` y sus
 * lenguajes (~260KB): se carga con `React.lazy` desde `ChatMessageItem` y
 * `ThinkingContent` para que no forme parte del bundle inicial. Mientras
 * el chunk se descarga (o durante streaming) se muestra texto plano.
 */
export function RichMarkdown({ content, copyToClipboard }: RichMarkdownProps) {
  const components = React.useMemo(
    () => createMarkdownComponents(copyToClipboard),
    [copyToClipboard]
  );

  return (
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={components}>
      {content}
    </ReactMarkdown>
  );
}
