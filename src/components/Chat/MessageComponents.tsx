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

import { ExternalLink, Eye, Search, Trash, X as XIcon } from 'lucide-react';
import React, { useState } from 'react';
import type { GroundedSegment } from '../../types';

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
  if (image.data) {
    return `data:${image.contentType ?? 'image/png'};base64,${image.data}`;
  }

  return image.url;
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

/**
 * Props para el componente GroundedSegmentsIndicator
 *
 * @interface GroundedSegmentsProps
 * @property {readonly GroundedSegment[]} segments - Lista de segmentos fundamentados con fuentes
 * @property {boolean} isDarkMode - Indica si el modo oscuro está activado
 */
interface GroundedSegmentsProps {
  readonly segments: readonly GroundedSegment[];
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
export const MessageImages: React.FC<MessageImagesProps> = ({ images, isDarkMode }) => {
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  return (
    <div className="mb-2">
      <div className="flex flex-wrap gap-2 mt-1">
        {images.map((image, index) => (
          <div key={`${image.url}-${index}`} className="relative">
            <button
              type="button"
              className={`relative cursor-pointer rounded-md overflow-hidden border ${
                isDarkMode ? 'border-slate-700' : 'border-slate-300'
              }`}
              style={{ maxWidth: '150px', maxHeight: '150px' }}
              onClick={() => setExpandedImage(getImageSource(image))}
              aria-label={`Abrir imagen adjunta ${index + 1}`}
            >
              <img
                src={getImageSource(image)}
                alt={`Imagen adjunta ${index + 1}`}
                className="max-h-[150px] max-w-[150px] object-contain"
              />
              <div
                className={`absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 ${
                  isDarkMode ? 'bg-slate-900/60' : 'bg-slate-800/40'
                } transition-opacity`}
              >
                <Eye className="text-white w-5 h-5" />
              </div>
            </button>
          </div>
        ))}
      </div>

      {/* Visor de imagen expandida */}
      {expandedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Cerrar imagen ampliada"
            onClick={() => setExpandedImage(null)}
          />
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={expandedImage}
              alt="Imagen ampliada"
              className="max-h-[90vh] max-w-full object-contain"
            />
            <button
              type="button"
              className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full"
              onClick={() => setExpandedImage(null)}
              aria-label="Cerrar imagen"
            >
              <XIcon size={20} />
            </button>
          </div>
        </div>
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
      <Search size={14} className="opacity-70" /> Búsquedas realizadas:
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
// GROUNDED SEGMENTS INDICATOR
// ============================================================================

/**
 * Componente indicador de segmentos fundamentados
 *
 * Visualiza segmentos de texto que están respaldados por fuentes específicas.
 * Cada segmento muestra sus fuentes de apoyo con niveles de confianza,
 * enlaces externos y información de credibilidad.
 *
 * @param {GroundedSegmentsProps} props - Propiedades del componente
 * @returns {JSX.Element} Elemento JSX con los segmentos fundamentados
 */
export const GroundedSegmentsIndicator: React.FC<GroundedSegmentsProps> = ({
  segments,
  isDarkMode,
}) => (
  <div className={`mb-4 space-y-3 text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
    {segments.map((segment, segIdx) => (
      <div key={`segment-${segIdx}`} className="space-y-2">
        <div className="font-medium">{segment.text}</div>
        <div className="space-y-1">
          {segment.sources.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                isDarkMode
                  ? 'bg-slate-800/50 hover:bg-slate-800'
                  : 'bg-slate-100/50 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <ExternalLink size={14} className="opacity-70" />
                <span className="hover:underline">
                  {source.title || new URL(source.url).hostname}
                </span>
              </div>
              <div
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  source.confidence >= 90
                    ? isDarkMode
                      ? 'bg-green-900/30 text-green-400'
                      : 'bg-green-100 text-green-700'
                    : source.confidence >= 70
                      ? isDarkMode
                        ? 'bg-yellow-900/30 text-yellow-400'
                        : 'bg-yellow-100 text-yellow-700'
                      : isDarkMode
                        ? 'bg-orange-900/30 text-orange-400'
                        : 'bg-orange-100 text-orange-700'
                }`}
              >
                {source.confidence}% Confianza
              </div>
            </a>
          ))}
        </div>
      </div>
    ))}
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
          Imágenes adjuntas ({uploadedImages.length})
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
              alt={`Imagen ${index + 1}`}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => onRemoveImage(index)}
              className="absolute top-0.5 right-0.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Eliminar imagen"
            >
              <Trash size={10} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
