/**
 * MessageComponents
 *
 * Componentes reutilizables para visualización de mensajes que incluyen:
 * - Adjuntos de imágenes con previsualización expandible
 * - Indicador de consultas de búsqueda realizadas
 * - Visualización de segmentos fundamentados con fuentes
 * - Citas de fuentes con niveles de confianza
 * - Previsualización de imágenes cargadas con opciones de eliminación
 * - Soporte completo para modo oscuro/claro
 *
 * @module MessageComponents
 * @example
 * ```tsx
 * import { MessageImages, SearchQueriesIndicator } from './MessageComponents';
 *
 * <MessageImages images={attachments} isDarkMode={isDarkMode} />
 * <SearchQueriesIndicator queries={searchQueries} isDarkMode={isDarkMode} />
 * ```
 */

import { Eye, Search, Trash, X as XIcon } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n';
import { getSafeImageSrc } from '../../utils/safeUrl';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Props para el componente MessageImages
 *
 * @interface MessageImagesProps
 * @property {Array} images - Array de objetos de imagen con url, contentType y data opcional
 * @property {boolean} isDarkMode - Indica si el modo oscuro está activado
 */
interface MessageImagesProps {
  readonly images: Array<{
    url: string;
    contentType?: string;
    data?: string;
  }>;
  readonly isDarkMode: boolean;
}

const getImageSource = (image: { url: string; contentType?: string; data?: string }): string => {
  const safe = getSafeImageSrc(image, '');
  if (safe) {
    return safe;
  }

  // Fallback conservador: si la URL no es http(s)/blob válida, no renderizar nada roto.
  if (typeof image.url === 'string' && image.url.startsWith('blob:')) {
    return image.url;
  }

  return '';
};

/**
 * Props para el componente SearchQueriesIndicator
 *
 * @interface SearchQueriesProps
 * @property {readonly string[]} queries - Lista de consultas de búsqueda realizadas
 * @property {boolean} isDarkMode - Indica si el modo oscuro está activado
 */
interface SearchQueriesProps {
  readonly queries: readonly string[];
  readonly isDarkMode: boolean;
}

// ============================================================================
// MESSAGE IMAGES COMPONENT
// ============================================================================

/**
 * Componente para mostrar imágenes adjuntas en mensajes
 *
 * Renderiza una galería de imágenes con funcionalidades de:
 * - Previsualización en miniatura
 * - Expansión a pantalla completa al hacer clic
 * - Navegación con teclado y mouse
 * - Botón de cierre en vista expandida
 * - Estilos adaptativos para modo oscuro/claro
 *
 * @param {MessageImagesProps} props - Propiedades del componente
 * @returns {JSX.Element} Elemento JSX con la galería de imágenes
 */

/**
 * Visor de imagen expandida accesible: `role="dialog"` modal, cierre con
 * Escape, foco inicial en el botón cerrar y restauración del foco al salir.
 */
const ImageZoomDialog: React.FC<{ imageSrc: string; onClose: () => void }> = ({
  imageSrc,
  onClose,
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    previousFocusRef.current = typeof document !== 'undefined' ? document.activeElement : null;
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      const previous = previousFocusRef.current;
      if (previous instanceof HTMLElement) {
        previous.focus();
      }
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('zoomedImageAlt')}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t('closeZoomedImage')}
        onClick={onClose}
        tabIndex={-1}
      />
      <div className="relative max-w-4xl max-h-[90vh]">
        <img
          src={imageSrc}
          alt={t('zoomedImageAlt')}
          className="max-h-[90vh] max-w-full object-contain"
        />
        <button
          ref={closeButtonRef}
          type="button"
          className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full"
          onClick={onClose}
          aria-label={t('closeImage')}
        >
          <XIcon size={20} />
        </button>
      </div>
    </div>
  );
};

export const MessageImages: React.FC<MessageImagesProps> = ({ images, isDarkMode }) => {
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  return (
    <div className="mb-2">
      <div className="flex flex-wrap gap-2 mt-1">
        {images.map((image, index) => {
          const src = getImageSource(image);
          if (!src) {
            return null;
          }
          return (
            <div key={`${image.url}-${index}`} className="relative">
              <button
                type="button"
                className={`relative cursor-pointer rounded-md overflow-hidden border ${
                  isDarkMode ? 'border-slate-700' : 'border-slate-300'
                }`}
                style={{ maxWidth: '150px', maxHeight: '150px' }}
                onClick={() => setExpandedImage(src)}
                aria-label={t('openAttachment', { index: index + 1 })}
              >
                <img
                  src={src}
                  alt={t('openAttachment', { index: index + 1 })}
                  className="max-h-[150px] max-w-[150px] object-contain"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                <div
                  className={`absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 focus-visible:opacity-100 ${
                    isDarkMode ? 'bg-slate-900/60' : 'bg-slate-800/40'
                  } transition-opacity`}
                >
                  <Eye className="text-white w-5 h-5" />
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Visor de imagen expandida */}
      {expandedImage && (
        <ImageZoomDialog imageSrc={expandedImage} onClose={() => setExpandedImage(null)} />
      )}
    </div>
  );
};

// ============================================================================
// SEARCH QUERIES INDICATOR
// ============================================================================

/**
 * Componente indicador de consultas de búsqueda realizadas
 *
 * Muestra las consultas de búsqueda web que se realizaron para generar
 * la respuesta del asistente. Proporciona transparencia sobre qué
 * información se buscó para fundamentar la respuesta.
 *
 * @param {SearchQueriesProps} props - Propiedades del componente
 * @returns {JSX.Element} Elemento JSX con la lista de consultas
 */
export const SearchQueriesIndicator: React.FC<SearchQueriesProps> = ({ queries, isDarkMode }) => (
  <div className={`mb-2 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
    <div className="flex items-center gap-1.5 font-medium">
      <Search size={14} className="opacity-70" /> {t('searchesPerformed')}:
    </div>
    <div className="mt-1 space-y-0.5 pl-5">
      {queries.map((query) => (
        <div key={query} className="opacity-80">
          • {query}
        </div>
      ))}
    </div>
  </div>
);

// ============================================================================
// IMAGE UPLOAD PREVIEW COMPONENT
// ============================================================================

/**
 * Props para el componente ImageUploadPreview
 *
 * @interface ImageUploadPreviewProps
 * @property {readonly Array} uploadedImages - Array de imágenes cargadas con url, contentType y data
 * @property {boolean} isDarkMode - Indica si el modo oscuro está activado
 * @property {(index: number) => void} onRemoveImage - Función callback para remover una imagen por índice
 */
interface ImageUploadPreviewProps {
  readonly uploadedImages: readonly {
    readonly url: string;
    readonly contentType?: string;
    readonly data?: string;
  }[];
  readonly isDarkMode: boolean;
  readonly onRemoveImage: (index: number) => void;
}

/**
 * Componente de previsualización de imágenes cargadas
 *
 * Muestra una previsualización compacta de las imágenes que el usuario
 * ha cargado antes de enviar el mensaje. Incluye opciones para remover
 * imágenes individuales y un contador del total de imágenes.
 *
 * @param {ImageUploadPreviewProps} props - Propiedades del componente
 * @returns {JSX.Element | null} Elemento JSX con la previsualización o null si no hay imágenes
 */
export const ImageUploadPreview: React.FC<ImageUploadPreviewProps> = ({
  uploadedImages,
  isDarkMode,
  onRemoveImage,
}) => {
  if (uploadedImages.length === 0) {
    return null;
  }

  return (
    <div
      className={`mb-2 p-2 rounded-lg ${
        isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'
      } border`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
          {t('attachedImages')} ({uploadedImages.length})
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {uploadedImages.map((image, index) => (
          <div
            key={image.url}
            className={`relative group rounded-md overflow-hidden h-16 w-16 border ${
              isDarkMode ? 'border-slate-600' : 'border-slate-300'
            }`}
          >
            <img
              src={image.url}
              alt={t('openAttachment', { index: index + 1 })}
              className="h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <button
              type="button"
              onClick={() => onRemoveImage(index)}
              className="absolute top-0.5 right-0.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity"
              title={t('removeImage')}
              aria-label={t('removeImage')}
            >
              <Trash size={10} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
