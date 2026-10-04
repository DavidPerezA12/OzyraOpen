/**
 * Generador de IDs únicos con fallback.
 *
 * `crypto.randomUUID` no existe en contextos no seguros (`http://`), workers
 * antiguos o Safari viejo: sin fallback, crear chats/mensajes revienta.
 * Orden: `randomUUID` → `getRandomValues` (UUIDv4 manual) → `Math.random`.
 */
export function generateId(): string {
  try {
    if (typeof crypto !== 'undefined') {
      if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
      if (typeof crypto.getRandomValues === 'function') {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        const sixth = bytes[6] ?? 0;
        const eighth = bytes[8] ?? 0;
        bytes[6] = (sixth & 0x0f) | 0x40;
        bytes[8] = (eighth & 0x3f) | 0x80;
        const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      }
    }
  } catch {
    // Entorno restringido: usar el fallback no criptográfico de abajo.
  }

  return `id-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffff)
    .toString(36)
    .padStart(4, '0')}`;
}
