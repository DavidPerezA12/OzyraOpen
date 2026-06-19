/**
 * ScrollToBottom Component
 *
 * Botón flotante que aparece cuando el usuario hace scroll hacia arriba
 * en el contenedor de chat. Permite volver rápidamente al final de la conversación.
 *
 * Features:
 * - Auto-hide cuando está en la parte inferior
 * - Animaciones suaves de entrada/salida
 * - Indicador de nuevos mensajes
 * - Accesible con teclado
 * - Responsive design
 *
 * @module ScrollToBottom
 * @example
 * ```tsx
 * <ScrollToBottom
 *   containerRef={messagesContainerRef}
 *   hasNewMessages={hasUnreadMessages}
 * />
 * ```
 */

import React, { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react';
import { ArrowDown } from 'lucide-react';

/**
 * Props para el componente ScrollToBottom
 */
interface ScrollToBottomProps {
  /** Referencia al contenedor con scroll */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Indica si hay nuevos mensajes sin leer */
  hasNewMessages?: boolean;
  /** Offset desde el bottom para considerar "en el fondo" (default: 100px) */
  threshold?: number;
  /** Callback cuando se hace click */
  onClick?: () => void;
  /** Valor que cambia cuando el contenido del chat crece */
  followKey?: string | number | null;
  /** Valor que cambia cuando se abre un hilo distinto */
  resetKey?: string | number | null;
}

/**
 * Componente ScrollToBottom
 *
 * Botón flotante con animaciones que aparece cuando el usuario
 * no está en la parte inferior del chat.
 */
export const ScrollToBottom: React.FC<ScrollToBottomProps> = ({
  containerRef,
  hasNewMessages = false,
  threshold = 100,
  onClick,
  followKey = null,
  resetKey = null,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const isPinnedToBottomRef = useRef(true);

  /**
   * Verifica si el scroll está cerca del final
   */
  const checkScrollPosition = useCallback(() => {
    if (!containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isAtBottom = distanceFromBottom <= threshold;

    isPinnedToBottomRef.current = isAtBottom;
    setIsVisible(!isAtBottom);
  }, [containerRef, threshold]);

  /**
   * Scroll suave hacia el final
   */
  const scrollToBottom = useCallback(() => {
    if (!containerRef.current) {
      return;
    }

    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: 'smooth',
    });

    onClick?.();
  }, [containerRef, onClick]);

  const scrollToBottomInstant = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
    isPinnedToBottomRef.current = true;
    setIsVisible(false);
  }, [containerRef]);

  /**
   * Cada hilo debe abrir anclado al final aunque el hilo anterior estuviera
   * scrolleado hacia arriba.
   */
  useLayoutEffect(() => {
    isPinnedToBottomRef.current = true;
    scrollToBottomInstant();
  }, [resetKey, scrollToBottomInstant]);

  /**
   * Registrar listener de scroll
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    // Check inicial
    checkScrollPosition();

    let frameId: number | null = null;
    const handleScroll = () => {
      if (frameId !== null) {
        return;
      }
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        checkScrollPosition();
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
      container.removeEventListener('scroll', handleScroll);
    };
  }, [containerRef, checkScrollPosition]);

  /**
   * Seguir el crecimiento del contenido solo si el usuario ya estaba anclado al fondo.
   */
  useLayoutEffect(() => {
    if (!isPinnedToBottomRef.current) {
      checkScrollPosition();
      return;
    }

    scrollToBottomInstant();
  }, [followKey, checkScrollPosition, scrollToBottomInstant]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (isPinnedToBottomRef.current) {
        scrollToBottomInstant();
      } else {
        checkScrollPosition();
      }
    });
    observer.observe(container);
    if (container.firstElementChild) {
      observer.observe(container.firstElementChild);
    }

    return () => observer.disconnect();
  }, [containerRef, followKey, checkScrollPosition, scrollToBottomInstant]);

  // No renderizar si no es visible
  if (!isVisible) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={scrollToBottom}
      aria-label="Desplazar al final"
      title="Ir al final de la conversación"
      className={`
        fixed bottom-24 right-6 z-50
        flex items-center justify-center
        w-11 h-11 rounded-full
        glass-panel border border-[var(--border-primary)]
        text-[var(--text-primary)]
        transition-all duration-200
        hover:shadow-[var(--shadow-glow)]
        hover:-translate-y-0.5
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]
        animate-fade-in
        ${hasNewMessages ? 'ring-2 ring-[var(--color-primary)]' : ''}
      `}
    >
      {/* Indicador de nuevos mensajes */}
      {hasNewMessages && (
        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border-2 border-white dark:border-zinc-900" />
        </span>
      )}

      {/* Icono de flecha */}
      <ArrowDown className="w-5 h-5 text-current" strokeWidth={2.5} />
    </button>
  );
};
