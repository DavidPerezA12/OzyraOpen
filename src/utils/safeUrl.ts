/**
 * safeUrl — helpers para validar URLs que vienen del modelo / web / imports.
 *
 * Solo permite http(s) y mailto para enlaces renderizados. Todo lo demás
 * (javascript:, data:, vbscript:, etc.) se considera inseguro.
 */

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export const isSafeHttpUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.trim() === '') {
    return false;
  }

  const trimmed = value.trim();

  // Bloquear explícitamente esquemas peligrosos aunque el parser los acepte.
  if (/^(javascript|data|vbscript|blob|file):/i.test(trimmed)) {
    // Permitir data:image/* solo para <img> a través de getSafeImageSrc,
    // nunca como href de enlace.
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const isSafeLinkHref = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.trim() === '') {
    return false;
  }

  const trimmed = value.trim();

  // Anclas internas (#...) son seguras.
  if (trimmed.startsWith('#')) {
    return true;
  }

  // Rutas relativas ("/docs", "./x", "page") sin esquema: seguras.
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../') ||
    /^[^:/?#]+(?:[/?#]|$)/.test(trimmed)
  ) {
    // Si parece tener esquema (contiene ':' antes de /?#), validarlo.
    const schemeMatch = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.exec(trimmed);
    if (schemeMatch) {
      try {
        const parsed = new URL(trimmed);
        return SAFE_PROTOCOLS.has(parsed.protocol);
      } catch {
        return false;
      }
    }
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    return SAFE_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
};

/**
 * Devuelve un hostname legible sin romper el render si la URL es inválida.
 * Nunca lanza.
 */
export const getSafeHostname = (value: unknown, fallback = 'enlace'): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    return fallback;
  }

  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return fallback;
    }
    return parsed.hostname || fallback;
  } catch {
    return fallback;
  }
};

/**
 * Normaliza el src de imágenes adjuntas. Solo permite http(s) y
 * data:image/* (png/jpeg/webp/gif). Nunca lanza.
 */
export const getSafeImageSrc = (
  image: { url: string; contentType?: string; data?: string },
  fallback = ''
): string => {
  if (image.data) {
    const contentType = (image.contentType ?? 'image/png').toLowerCase();
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!allowed.includes(contentType)) {
      return fallback;
    }
    // base64 básico: evita inyectar comillas o esquemas raros.
    if (!/^[A-Za-z0-9+/=]+$/.test(image.data)) {
      return fallback;
    }
    return `data:${contentType};base64,${image.data}`;
  }

  if (typeof image.url !== 'string') {
    return fallback;
  }

  const url = image.url.trim();
  if (url.startsWith('blob:')) {
    return url;
  }

  return isSafeHttpUrl(url) ? url : fallback;
};
