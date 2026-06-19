/**
 * MarkdownComponents
 *
 * Componentes reutilizables para renderizado de Markdown con:
 * - Resaltado de sintaxis para bloques de código
 * - Iconos específicos por lenguaje de programación
 * - Funcionalidad de copiado integrada
 * - Soporte para modo oscuro/claro
 * - Diseño responsivo y accesible
 * - Estilos personalizados para elementos HTML
 *
 * @module MarkdownComponents
 * @example
 * ```tsx
 * import { createMarkdownComponents } from './MarkdownComponents';
 *
 * const components = createMarkdownComponents(copyToClipboard);
 *
 * <ReactMarkdown
 *   remarkPlugins={[remarkGfm]}
 *   components={components}
 * >
 *   {markdownContent}
 * </ReactMarkdown>
 * ```
 */

import { Copy } from 'lucide-react';
import React from 'react';
import type { Components } from 'react-markdown';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import csharp from 'react-syntax-highlighter/dist/esm/languages/prism/csharp';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import diff from 'react-syntax-highlighter/dist/esm/languages/prism/diff';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import kotlin from 'react-syntax-highlighter/dist/esm/languages/prism/kotlin';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import php from 'react-syntax-highlighter/dist/esm/languages/prism/php';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import ruby from 'react-syntax-highlighter/dist/esm/languages/prism/ruby';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import swift from 'react-syntax-highlighter/dist/esm/languages/prism/swift';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';

SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('c', cpp);
SyntaxHighlighter.registerLanguage('cpp', cpp);
SyntaxHighlighter.registerLanguage('csharp', csharp);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('diff', diff);
SyntaxHighlighter.registerLanguage('go', go);
SyntaxHighlighter.registerLanguage('html', markup);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('kotlin', kotlin);
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('php', php);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('ruby', ruby);
SyntaxHighlighter.registerLanguage('rust', rust);
SyntaxHighlighter.registerLanguage('shell', bash);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('swift', swift);
SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('xml', markup);
SyntaxHighlighter.registerLanguage('yaml', yaml);

/* Tema de sintaxis monocromo: jerarquía por peso tipográfico y escala de grises. */
const syntaxTheme: Record<string, React.CSSProperties> = {
  'code[class*="language-"]': {
    color: 'var(--text-primary)',
    background: 'transparent',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.875rem',
  },
  comment: { color: 'var(--text-muted)', fontStyle: 'italic' },
  prolog: { color: 'var(--text-muted)' },
  punctuation: { color: 'var(--text-secondary)' },
  property: { color: 'var(--text-primary)' },
  tag: { color: 'var(--text-primary)', fontWeight: 600 },
  boolean: { color: 'var(--text-primary)', fontWeight: 600 },
  number: { color: 'var(--text-primary)' },
  constant: { color: 'var(--text-primary)' },
  symbol: { color: 'var(--text-primary)' },
  deleted: { color: 'var(--text-muted)', textDecoration: 'line-through' },
  selector: { color: 'var(--text-primary)' },
  'attr-name': { color: 'var(--text-secondary)' },
  string: { color: 'var(--text-secondary)' },
  char: { color: 'var(--text-secondary)' },
  builtin: { color: 'var(--text-primary)' },
  inserted: { color: 'var(--text-primary)' },
  atrule: { color: 'var(--text-primary)', fontWeight: 600 },
  'attr-value': { color: 'var(--text-secondary)' },
  keyword: { color: 'var(--text-primary)', fontWeight: 600 },
  function: { color: 'var(--text-primary)' },
  'class-name': { color: 'var(--text-primary)' },
  regex: { color: 'var(--text-secondary)' },
  important: { color: 'var(--text-primary)', fontWeight: 'bold' },
  variable: { color: 'var(--text-primary)' },
  operator: { color: 'var(--text-secondary)' },
};

// ============================================================================
// MARKDOWN COMPONENTS
// ============================================================================

/**
 * Crea componentes de Markdown personalizados con modo oscuro y funcionalidad de copiado
 *
 * @param {(text: string) => void} copyToClipboard - Función para copiar texto al portapapeles
 * @returns {Components} Objeto con componentes personalizados para ReactMarkdown
 * @description Genera un conjunto completo de componentes Markdown personalizados que incluyen:
 * - Bloques de código con resaltado de sintaxis
 * - Botones de copiado para código
 * - Estilos adaptativos para modo oscuro/claro
 * - Elementos HTML estilizados (párrafos, listas, encabezados, etc.)
 * - Manejo especial de anidamiento DOM para evitar problemas de validación
 */
type CodeComponentProps = React.HTMLAttributes<HTMLElement> & {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  node?: unknown;
};

export const createMarkdownComponents = (copyToClipboard: (text: string) => void): Components => ({
  code({ inline, className, children, ...restProps }: CodeComponentProps) {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : 'text';

    return !inline && match ? (
      <div className="code-block group relative">
        <div className="code-block__header">
          <span className="code-block__lang">{language}</span>
          <button
            type="button"
            onClick={() => copyToClipboard(String(children))}
            className="code-block__copy"
          >
            <Copy size={12} />
            <span>Copiar</span>
          </button>
        </div>
        <div className="relative">
          <SyntaxHighlighter
            {...restProps}
            style={syntaxTheme}
            language={language}
            PreTag="div"
            showLineNumbers={true}
            lineNumberStyle={{
              minWidth: '3em',
              paddingRight: '1em',
              color: 'var(--text-muted)',
              backgroundColor: 'transparent',
              borderRight: '1px solid var(--border-primary)',
              marginRight: '1em',
              textAlign: 'right',
              userSelect: 'none',
            }}
            customStyle={{
              margin: 0,
              borderRadius: 0,
              background: 'var(--bg-secondary)',
              padding: '1.25rem 1.5rem',
              fontSize: '0.8125rem',
              lineHeight: '1.6',
            }}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        </div>
      </div>
    ) : (
      <code className="code-inline" {...restProps}>
        {children}
      </code>
    );
  },
  p: (props) => {
    // Evitar que los párrafos contengan divs que puedan causar problemas de DOM nesting
    const { children, ...restProps } = props;
    return (
      <div className="mb-1 last:mb-0" {...restProps}>
        {children}
      </div>
    );
  },
  ul: (props) => <ul className="mb-4 last:mb-0 list-disc pl-6 space-y-2" {...props} />,
  ol: (props) => <ol className="mb-4 last:mb-0 list-decimal pl-6 space-y-2" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  h1: ({ children, ...props }) => (
    <h1
      className="text-xl font-semibold mb-4 mt-6 first:mt-0 text-[var(--text-primary)]"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      className="text-lg font-semibold mb-3 mt-5 first:mt-0 text-[var(--text-primary)]"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      className="text-base font-semibold mb-3 mt-4 first:mt-0 text-[var(--text-primary)]"
      {...props}
    >
      {children}
    </h3>
  ),
  blockquote: (props) => (
    <blockquote
      className="border-l-[3px] border-[var(--color-primary)] bg-[var(--color-primary-soft)] pl-4 py-2 mb-4 italic text-[var(--text-secondary)] rounded-r-[var(--radius-sm)]"
      {...props}
    />
  ),
  a: ({ children, ...props }) => (
    <a
      className="text-[var(--color-secondary)] hover:text-[var(--color-primary)] underline underline-offset-2 transition-colors"
      {...props}
    >
      {children}
    </a>
  ),
});
