import {
  Bot,
  Check,
  Copy,
  CreditCard as Edit2,
  ExternalLink,
  Globe,
  RefreshCw,
  X as XIcon,
} from 'lucide-react';
import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message, ModelInfo } from '../../types';
import { createMarkdownComponents } from './MarkdownComponents';
import {
  GroundedSegmentsIndicator,
  MessageImages,
  SearchQueriesIndicator,
} from './MessageComponents';
import { getConfidenceBadgeStyles } from './styles';
import { ThinkingContent } from './ThinkingContent';

const MAX_MESSAGE_LENGTH = 500;
const REMARK_PLUGINS = [remarkGfm];

interface ChatMessageItemProps {
  message: Message;
  presentation: {
    isLatest: boolean;
    isDarkMode: boolean;
    isLoading: boolean;
    isStreamingAssistant: boolean;
    isExpanded: boolean;
    isCopied: boolean;
    showThinking: boolean;
    supportsReasoning: boolean;
  };
  editingMessageId: string | null;
  editingContent: string;
  availableModels: readonly ModelInfo[];
  copyToClipboard: (text: string) => void;
  startEditingMessage: (message: Message) => void;
  saveMessageEdit: (messageId: string) => void;
  cancelMessageEdit: () => void;
  regenerateResponse: (messageId?: string) => void;
  setEditingContent: (content: string) => void;
  onCopyMessage: (message: Message) => void;
  onToggleExpansion: (messageId: string) => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  presentation,
  editingMessageId,
  editingContent,
  availableModels,
  copyToClipboard,
  startEditingMessage,
  saveMessageEdit,
  cancelMessageEdit,
  regenerateResponse,
  setEditingContent,
  onCopyMessage,
  onToggleExpansion,
}) => {
  const {
    isLatest,
    isDarkMode,
    isLoading,
    isStreamingAssistant,
    isExpanded,
    isCopied,
    showThinking,
    supportsReasoning,
  } = presentation;
  const markdownComponents = useMemo(
    () => createMarkdownComponents(copyToClipboard),
    [copyToClipboard]
  );
  const modelInfo = availableModels.find((model) => model.id === message.model);
  const ModelIcon = modelInfo?.icon || Bot;
  const actionVisibility = isCopied ? 'copy-actions-visible' : '';

  return (
    <div
      id={`message-${message.id}`}
      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} ${isLatest ? 'message-bubble' : ''} mb-2`}
    >
      <div className={`relative group ${message.role === 'user' ? 'max-w-[85%]' : 'w-full'}`}>
        {editingMessageId === message.id ? (
          <div className="px-3.5 py-2 text-sm leading-relaxed rounded-[var(--radius-lg)] border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)]">
            <textarea
              value={editingContent}
              onChange={(event) => setEditingContent(event.target.value)}
              className="w-full bg-transparent resize-none focus:outline-none text-[var(--text-primary)] custom-scrollbar"
              rows={Math.max(editingContent.split('\n').length, 1)}
              aria-label="Editar mensaje"
            />
            <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-[var(--border-primary)]">
              <button
                type="button"
                onClick={cancelMessageEdit}
                className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                title="Cancelar edicion"
              >
                <XIcon size={14} />
              </button>
              <button
                type="button"
                onClick={() => saveMessageEdit(message.id)}
                className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                title="Guardar cambios"
              >
                <Check size={14} />
              </button>
            </div>
          </div>
        ) : (
          <>
            {message.role === 'assistant' && Boolean(message.searchQueries?.length) && (
              <SearchQueriesIndicator
                queries={message.searchQueries ?? []}
                isDarkMode={isDarkMode}
              />
            )}

            {message.role === 'assistant' && Boolean(message.groundedSegments?.length) && (
              <GroundedSegmentsIndicator
                segments={message.groundedSegments ?? []}
                isDarkMode={isDarkMode}
              />
            )}

            {message.thinkingContent && showThinking && supportsReasoning && (
              <ThinkingContent
                content={message.thinkingContent}
                isStreaming={isStreamingAssistant}
                copyToClipboard={copyToClipboard}
              />
            )}

            {Boolean(message.attachments?.length) && (
              <MessageImages
                images={(message.attachments ?? []).filter(
                  (attachment) => attachment.type === 'image'
                )}
                isDarkMode={isDarkMode}
              />
            )}

            <div
              className={`text-sm leading-relaxed break-words ${
                message.role === 'user'
                  ? 'msg-user-bubble'
                  : `msg-assistant-text ${isStreamingAssistant ? 'animate-fade-in' : ''}`
              }`}
            >
              {message.role === 'user' && message.content.length > MAX_MESSAGE_LENGTH ? (
                <>
                  <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={markdownComponents}>
                    {isExpanded
                      ? message.content
                      : `${message.content.slice(0, MAX_MESSAGE_LENGTH)}...`}
                  </ReactMarkdown>
                  <button
                    type="button"
                    onClick={() => onToggleExpansion(message.id)}
                    className="mt-2 text-xs text-white/80 hover:text-white underline transition-colors focus:outline-none"
                  >
                    {isExpanded ? 'Mostrar menos' : 'Mostrar más'}
                  </button>
                </>
              ) : (
                <>
                  <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={markdownComponents}>
                    {message.content}
                  </ReactMarkdown>
                  {message.role === 'assistant' &&
                    isStreamingAssistant &&
                    message.content.trim().length === 0 && (
                      <output
                        className="typing-ellipsis align-baseline opacity-80"
                        aria-label="Generando"
                      >
                        <span className="typing-ellipsis__dot" aria-hidden="true" />
                        <span className="typing-ellipsis__dot" aria-hidden="true" />
                        <span className="typing-ellipsis__dot" aria-hidden="true" />
                      </output>
                    )}
                </>
              )}

              {message.role === 'user' && (
                <div
                  className={`absolute right-0 -bottom-6 flex items-center opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-150 ${actionVisibility}`}
                >
                  <button
                    type="button"
                    onClick={() => onCopyMessage(message)}
                    className={`copy-action-btn p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors ${isCopied ? 'copy-action-btn--copied' : ''}`}
                    title={isCopied ? 'Copiado' : 'Copiar mensaje'}
                    aria-label={isCopied ? 'Mensaje copiado' : 'Copiar mensaje'}
                  >
                    {isCopied ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEditingMessage(message)}
                    className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    title="Editar mensaje"
                    aria-label="Editar mensaje"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => regenerateResponse(message.id)}
                    className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    title="Reenviar mensaje"
                    aria-label="Reenviar mensaje"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
              )}
            </div>

            {message.role === 'assistant' && Boolean(message.annotations?.length) && (
              <div className="mb-2 p-3 rounded-[var(--radius-lg)] border border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-xs text-[var(--text-secondary)]">
                <div className="flex items-center gap-1.5 font-medium mb-2 text-[var(--text-primary)]">
                  <Globe size={14} /> Fuentes citadas
                </div>
                <div className="space-y-1.5">
                  {message.annotations?.map((annotation) => (
                    <a
                      key={annotation.url_citation.url}
                      href={annotation.url_citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between px-3 py-2 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-surface)] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <ExternalLink size={14} className="opacity-70" />
                        <span className="hover:underline">
                          {annotation.url_citation.title ||
                            new URL(annotation.url_citation.url).hostname}
                        </span>
                      </div>
                      {annotation.url_citation.confidence && (
                        <div
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${getConfidenceBadgeStyles(
                            annotation.url_citation.confidence,
                            isDarkMode
                          )}`}
                        >
                          {annotation.url_citation.confidence}% Confianza
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {message.role !== 'user' && (
              <div
                className={`absolute left-0 -bottom-6 flex items-center opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-150 ${actionVisibility}`}
              >
                <span className="flex items-center gap-1 text-[0.6875rem] text-[var(--text-muted)] select-none mr-1.5">
                  <ModelIcon size={11} className="opacity-60 shrink-0" />
                  <span className="max-w-[160px] truncate">
                    {modelInfo?.name || message.model || 'IA'}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="w-px h-3 bg-[var(--border-strong)] mx-1.5 shrink-0"
                />
                <button
                  type="button"
                  onClick={() => onCopyMessage(message)}
                  className={`copy-action-btn p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors ${isCopied ? 'copy-action-btn--copied' : ''}`}
                  title={isCopied ? 'Copiado' : 'Copiar respuesta'}
                  aria-label={isCopied ? 'Respuesta copiada' : 'Copiar respuesta'}
                >
                  {isCopied ? <Check size={13} /> : <Copy size={13} />}
                </button>
                <button
                  type="button"
                  onClick={() => regenerateResponse(message.id)}
                  className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  title="Regenerar respuesta"
                  aria-label="Regenerar respuesta"
                  disabled={isLoading}
                >
                  <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
