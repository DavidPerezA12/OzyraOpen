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
import React, { Suspense } from 'react';
import { getModelInfo, useModelCatalog } from '../../models/catalog';
import type { Message } from '../../types';
import { getSafeHostname, isSafeLinkHref } from '../../utils/safeUrl';
import { MessageImages, SearchQueriesIndicator } from './MessageComponents';
import { getConfidenceBadgeStyles } from './styles';
import { ThinkingContent } from './ThinkingContent';
import { t, useLanguage } from '../../i18n';

const MAX_MESSAGE_LENGTH = 500;

// Markdown completo (GFM + highlight, ~260KB) en chunk diferido: no forma
// parte del bundle inicial y se descarga solo cuando hay mensajes que
// renderizar. Durante el streaming se muestra texto plano para no re-parsear
// en cada token.
const RichMarkdown = React.lazy(() =>
  import('./RichMarkdown').then((module) => ({ default: module.RichMarkdown }))
);

const PlainMessageText: React.FC<{ content: string }> = ({ content }) => (
  <div className="whitespace-pre-wrap">{content}</div>
);

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
  copyToClipboard: (text: string) => void;
  startEditingMessage: (message: Message) => void;
  saveMessageEdit: (messageId: string) => void;
  cancelMessageEdit: () => void;
  regenerateResponse: (messageId?: string) => void;
  setEditingContent: (content: string) => void;
  onCopyMessage: (message: Message) => void;
  onToggleExpansion: (messageId: string) => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = React.memo(
  ({
    message,
    presentation,
    editingMessageId,
    editingContent,
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
    // Suscripciones explícitas: el memo no ve cambios de idioma ni de catálogo.
    useLanguage();
    useModelCatalog();
    const modelInfo = message.model ? getModelInfo(message.model) : undefined;
    const ModelIcon = modelInfo?.icon ?? Bot;
    const actionVisibility = isCopied ? 'copy-actions-visible' : '';

    return (
      <div
        id={`message-${message.id}`}
        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} ${isLatest ? 'message-bubble' : ''} mb-2`}
      >
        <div className={`relative group ${message.role === 'user' ? 'max-w-[85%]' : 'w-full'}`}>
          {editingMessageId === message.id ? (
            <div className="px-3.5 py-2 text-sm leading-relaxed rounded-[var(--radius-lg)] border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)]">
              <label htmlFor={`edit-message-${message.id}`} className="sr-only">
                {t('editMessageContent')}
              </label>
              <textarea
                id={`edit-message-${message.id}`}
                value={editingContent}
                onChange={(event) => setEditingContent(event.target.value)}
                className="w-full bg-transparent resize-none focus:outline-none text-[var(--text-primary)] custom-scrollbar"
                rows={Math.max(editingContent.split('\n').length, 1)}
              />
              <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-[var(--border-primary)]">
                <button
                  type="button"
                  onClick={cancelMessageEdit}
                  className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                  title={t('cancelEdit')}
                  aria-label={t('cancelEdit')}
                >
                  <XIcon size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => saveMessageEdit(message.id)}
                  className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                  title={t('saveChanges')}
                  aria-label={t('saveChanges')}
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
                    <Suspense
                      fallback={
                        <PlainMessageText
                          content={
                            isExpanded
                              ? message.content
                              : `${message.content.slice(0, MAX_MESSAGE_LENGTH)}...`
                          }
                        />
                      }
                    >
                      <RichMarkdown
                        content={
                          isExpanded
                            ? message.content
                            : `${message.content.slice(0, MAX_MESSAGE_LENGTH)}...`
                        }
                        copyToClipboard={copyToClipboard}
                      />
                    </Suspense>
                    <button
                      type="button"
                      onClick={() => onToggleExpansion(message.id)}
                      className="mt-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline transition-colors"
                    >
                      {isExpanded ? t('showLess') : t('showMore')}
                    </button>
                  </>
                ) : message.role !== 'user' && isStreamingAssistant ? (
                  <>
                    <PlainMessageText content={message.content} />
                    {message.role === 'assistant' &&
                      isStreamingAssistant &&
                      message.content.trim().length === 0 && (
                        <output
                          className="typing-ellipsis align-baseline opacity-80"
                          aria-label={t('generatingLabel')}
                        >
                          <span className="typing-ellipsis__dot" aria-hidden="true" />
                          <span className="typing-ellipsis__dot" aria-hidden="true" />
                          <span className="typing-ellipsis__dot" aria-hidden="true" />
                        </output>
                      )}
                  </>
                ) : (
                  <Suspense fallback={<PlainMessageText content={message.content} />}>
                    <RichMarkdown content={message.content} copyToClipboard={copyToClipboard} />
                  </Suspense>
                )}

                {message.role === 'user' && (
                  <div
                    className={`absolute right-0 -bottom-6 flex items-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-150 ${actionVisibility}`}
                  >
                    <button
                      type="button"
                      onClick={() => onCopyMessage(message)}
                      className={`copy-action-btn p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors ${isCopied ? 'copy-action-btn--copied' : ''}`}
                      title={isCopied ? t('copied') : t('copyMessage')}
                      aria-label={isCopied ? t('messageCopied') : t('copyMessage')}
                    >
                      {isCopied ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditingMessage(message)}
                      className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                      title={t('editMessage')}
                      aria-label={t('editMessage')}
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => regenerateResponse(message.id)}
                      className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                      title={t('resendMessage')}
                      aria-label={t('resendMessage')}
                    >
                      <RefreshCw size={13} />
                    </button>
                  </div>
                )}
              </div>

              {message.role === 'assistant' && Boolean(message.annotations?.length) && (
                <div className="mb-2 p-3 rounded-[var(--radius-lg)] border border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-xs text-[var(--text-secondary)]">
                  <div className="flex items-center gap-1.5 font-medium mb-2 text-[var(--text-primary)]">
                    <Globe size={14} /> {t('citedSources')}
                  </div>
                  <div className="space-y-1.5">
                    {(message.annotations ?? [])
                      .filter((annotation) => isSafeLinkHref(annotation.url_citation.url))
                      .map((annotation) => (
                        <a
                          key={annotation.url_citation.url}
                          href={annotation.url_citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          referrerPolicy="no-referrer"
                          className="flex items-center justify-between px-3 py-2 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-surface)] transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <ExternalLink size={14} className="opacity-70" />
                            <span className="hover:underline">
                              {annotation.url_citation.title ||
                                getSafeHostname(annotation.url_citation.url)}
                            </span>
                          </div>
                          {annotation.url_citation.confidence && (
                            <div
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${getConfidenceBadgeStyles(
                                annotation.url_citation.confidence,
                                isDarkMode
                              )}`}
                            >
                              {annotation.url_citation.confidence}% {t('confidenceLabel')}
                            </div>
                          )}
                        </a>
                      ))}
                  </div>
                </div>
              )}

              {message.role !== 'user' && (
                <div
                  className={`absolute left-0 -bottom-6 flex items-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-150 ${actionVisibility}`}
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
                    title={isCopied ? t('copied') : t('copyResponse')}
                    aria-label={isCopied ? t('responseCopied') : t('copyResponse')}
                  >
                    {isCopied ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => regenerateResponse(message.id)}
                    className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    title={t('regenerateResponse')}
                    aria-label={t('regenerateResponse')}
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
  }
);
