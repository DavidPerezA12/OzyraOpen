/**
 * ChatSidebar — T3.chat style layout
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { type Chat } from '../../types';

// ============================================================================
// ICONS
// ============================================================================

const CheckIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const MoreIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>
);

const EditIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

const PinIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const PinOffIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <line x1="9" y1="9" x2="15" y2="15" />
    <line x1="15" y1="9" x2="9" y2="15" />
  </svg>
);

const DownloadIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const TrashIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

// ============================================================================
// TYPES
// ============================================================================
interface ChatItemProps {
  readonly chat: Chat;
  readonly currentChat: Chat | null;
  readonly togglePinChat: (chatId: string) => void;
  readonly exportChat: (chat: Chat) => void;
  readonly deleteChat: (chatId: string) => void;
  readonly setCurrentChat: (chat: Chat) => void;
  readonly updateChatTitle: (chatId: string, newTitle: string) => void;
  readonly isGenerating: boolean;
}

interface ChatSidebarProps {
  readonly sidebarOpen: boolean;
  readonly setSidebarOpen: (open: boolean) => void;
  readonly currentChat: Chat | null;
  readonly chats: readonly Chat[];
  readonly setCurrentChat: (chat: Chat | null) => void;
  readonly createNewChat: () => void;
  readonly togglePinChat: (chatId: string) => void;
  readonly exportChat: (chat: Chat) => void;
  readonly deleteChat: (chatId: string) => void;
  readonly setShowSettings: (show: boolean) => void;
  readonly updateChatTitle: (chatId: string, newTitle: string) => void;
  readonly generatingChatIds: readonly string[];
}

type DateGroupKey = 'Hoy' | 'Ayer' | 'Esta semana' | 'Este mes' | 'Más antiguos';
const DATE_GROUP_ORDER: DateGroupKey[] = ['Hoy', 'Ayer', 'Esta semana', 'Este mes', 'Más antiguos'];

const getLastActivityTimestamp = (chat: Chat): number => {
  let latest = chat.createdAt;
  for (const message of chat.messages) {
    latest = Math.max(latest, message.timestamp);
  }
  return latest;
};

const getDateGroup = (timestamp: number): DateGroupKey => {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  if (timestamp >= today.getTime()) {
    return 'Hoy';
  }
  if (timestamp >= yesterday.getTime()) {
    return 'Ayer';
  }
  if (timestamp >= weekStart.getTime()) {
    return 'Esta semana';
  }
  if (timestamp >= monthStart.getTime()) {
    return 'Este mes';
  }
  return 'Más antiguos';
};

// ============================================================================
// CHAT ITEM
// ============================================================================
const ChatItemComponent: React.FC<ChatItemProps> = ({
  chat,
  currentChat,
  togglePinChat,
  exportChat,
  deleteChat,
  setCurrentChat,
  updateChatTitle,
  isGenerating,
}) => {
  const isPinned = chat.isPinned ?? false;
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const isActive = currentChat?.id === chat.id;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleSave = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const trimmed = editedTitle.trim();
    if (trimmed) {
      updateChatTitle(chat.id, trimmed);
      setIsEditingTitle(false);
    } else {
      setEditedTitle(chat.title || `Conversación ${chat.id.slice(-4)}`);
      setIsEditingTitle(false);
    }
  };

  const activateChat = () => {
    setCurrentChat(chat);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('chat', chat.id);
      url.searchParams.delete('newChat');
      window.history.replaceState({}, '', url.toString());
    } catch {
      /* ignore */
    }
  };

  const title = chat.title || `Conversación ${chat.id.slice(-4)}`;

  return (
    <div className="relative" ref={dropdownRef}>
      {isEditingTitle ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleTitleSave();
          }}
          className="flex items-center gap-1 px-1 py-0.5"
        >
          <input
            ref={titleInputRef}
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            aria-label="Título de la conversación"
            className="flex-1 px-2 py-1 rounded text-xs focus:outline-none"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-strong)',
              color: 'var(--text-primary)',
            }}
            maxLength={50}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setEditedTitle(title);
                setIsEditingTitle(false);
              }
            }}
          />
          <button type="submit" className="p-1 rounded" style={{ color: 'var(--accent)' }}>
            <CheckIcon />
          </button>
        </form>
      ) : (
        <div className={`chat-item group ${isActive ? 'chat-item--active' : ''}`}>
          <button
            type="button"
            onClick={activateChat}
            className="chat-item-select"
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="flex items-center gap-1.5 min-w-0">
              {isPinned && (
                <span style={{ color: 'var(--accent)', flexShrink: 0 }}>
                  <PinIcon />
                </span>
              )}
              <span className="truncate flex-1 text-left pr-4">{title}</span>
              {isGenerating && (
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0"
                  style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
                />
              )}
            </span>
          </button>

          {/* Context menu button — shows on hover */}
          <button
            type="button"
            className="chat-item-menu-trigger absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity z-10"
            onClick={() => setShowDropdown((current) => !current)}
            aria-label={`Más acciones para ${title}`}
            aria-expanded={showDropdown}
          >
            <span className="chat-item-more-btn">
              <MoreIcon />
            </span>
          </button>
        </div>
      )}

      {/* Dropdown */}
      {showDropdown && (
        <div className="chat-item-menu animate-slide-down">
          {[
            {
              label: 'Editar título',
              icon: <EditIcon />,
              onClick: () => {
                setEditedTitle(title);
                setIsEditingTitle(true);
                setShowDropdown(false);
              },
            },
            {
              label: isPinned ? 'Desfijar' : 'Fijar',
              icon: isPinned ? <PinOffIcon /> : <PinIcon />,
              onClick: () => {
                togglePinChat(chat.id);
                setShowDropdown(false);
              },
            },
            {
              label: 'Exportar',
              icon: <DownloadIcon />,
              onClick: () => {
                exportChat(chat);
                setShowDropdown(false);
              },
            },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                item.onClick();
              }}
              className="chat-item-menu-option"
            >
              <span className="flex items-center justify-center opacity-70">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
          <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.05)', margin: '2px 4px' }} />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              deleteChat(chat.id);
              setShowDropdown(false);
            }}
            className="chat-item-menu-option danger"
          >
            <span className="flex items-center justify-center">
              <TrashIcon />
            </span>
            <span>Eliminar</span>
          </button>
        </div>
      )}
    </div>
  );
};

const ChatItem = React.memo(
  ChatItemComponent,
  (prev, next) =>
    prev.chat.id === next.chat.id &&
    prev.chat.title === next.chat.title &&
    (prev.chat.isPinned ?? false) === (next.chat.isPinned ?? false) &&
    prev.currentChat?.id === next.currentChat?.id &&
    prev.isGenerating === next.isGenerating
);

// ============================================================================
// MAIN SIDEBAR
// ============================================================================
const ChatSidebar: React.FC<ChatSidebarProps> = ({
  sidebarOpen,
  setSidebarOpen,
  currentChat,
  chats,
  setCurrentChat,
  createNewChat,
  togglePinChat,
  exportChat,
  deleteChat,
  setShowSettings,
  updateChatTitle,
  generatingChatIds,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const closeOnMobile = () => {
    if (window.matchMedia('(max-width: 639px)').matches) {
      setSidebarOpen(false);
    }
  };

  const handleCreateNewChatClick = () => {
    createNewChat();
    closeOnMobile();
  };

  const selectChat = (chat: Chat) => {
    setCurrentChat(chat);
    closeOnMobile();
  };

  const filteredChats = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = q
      ? chats.filter(
          (c) =>
            c.title.toLowerCase().includes(q) ||
            c.messages.some((m) => m.content.toLowerCase().includes(q))
        )
      : chats;
    return Array.from(filtered).sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      return getLastActivityTimestamp(b) - getLastActivityTimestamp(a);
    });
  }, [searchQuery, chats]);

  const groupedChats = useMemo(() => {
    const pinned: Chat[] = [];
    const groups: Record<DateGroupKey, Chat[]> = {
      Hoy: [],
      Ayer: [],
      'Esta semana': [],
      'Este mes': [],
      'Más antiguos': [],
    };
    for (const chat of filteredChats) {
      if (chat.isPinned) {
        pinned.push(chat);
      } else {
        groups[getDateGroup(getLastActivityTimestamp(chat))].push(chat);
      }
    }
    return { pinned, groups };
  }, [filteredChats]);
  const generatingChatIdSet = useMemo(() => new Set(generatingChatIds), [generatingChatIds]);

  return (
    <div
      className="sidebar-panel flex-shrink-0 z-30 absolute sm:relative h-full sm:h-auto transition-all duration-300 ease-in-out overflow-hidden"
      style={{ width: sidebarOpen ? '260px' : '0' }}
    >
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          Ozyra <span className="gradient-text">Open</span>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="sidebar-close-btn sm:hidden"
          aria-label="Cerrar barra lateral"
        >
          <X size={17} />
        </button>
      </div>

      {/* New Chat button */}
      <div className="px-3 pb-3">
        <button type="button" onClick={handleCreateNewChatClick} className="sidebar-new-chat-btn">
          <Plus size={14} strokeWidth={2.5} />
          Nuevo chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-3">
        <div className="sidebar-search-container">
          <Search size={13} className="flex-shrink-0 opacity-70" />
          <input
            type="text"
            aria-label="Buscar conversaciones"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar conversaciones…"
          />
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-3">
        {filteredChats.length === 0 ? (
          <div
            className="text-center py-8"
            style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}
          >
            {searchQuery ? 'Sin resultados' : 'Sin conversaciones'}
          </div>
        ) : (
          <>
            {groupedChats.pinned.length > 0 && (
              <>
                <div className="sidebar-group-label">Fijados</div>
                {groupedChats.pinned.map((c) => (
                  <ChatItem
                    key={c.id}
                    chat={c}
                    currentChat={currentChat}
                    togglePinChat={togglePinChat}
                    exportChat={exportChat}
                    deleteChat={deleteChat}
                    setCurrentChat={selectChat}
                    updateChatTitle={updateChatTitle}
                    isGenerating={generatingChatIdSet.has(c.id)}
                  />
                ))}
              </>
            )}
            {DATE_GROUP_ORDER.map((groupKey) => {
              const gc = groupedChats.groups[groupKey];
              if (!gc.length) {
                return null;
              }
              return (
                <React.Fragment key={groupKey}>
                  <div className="sidebar-group-label">{groupKey}</div>
                  {gc.map((c) => (
                    <ChatItem
                      key={c.id}
                      chat={c}
                      currentChat={currentChat}
                      togglePinChat={togglePinChat}
                      exportChat={exportChat}
                      deleteChat={deleteChat}
                      setCurrentChat={selectChat}
                      updateChatTitle={updateChatTitle}
                      isGenerating={generatingChatIdSet.has(c.id)}
                    />
                  ))}
                </React.Fragment>
              );
            })}
          </>
        )}
      </div>

      {/* Footer / Profile */}
      <div className="sidebar-footer mt-auto">
        <button
          type="button"
          onClick={() => {
            setShowSettings(true);
            closeOnMobile();
          }}
          className="sidebar-settings-btn"
        >
          <span className="profile-name" style={{ fontSize: '0.875rem', fontWeight: 600 }}>
            Ajustes
          </span>
        </button>
      </div>
    </div>
  );
};

export default ChatSidebar;
