/**
 * Devuelve clases Tailwind para el badge de confianza mostrado en `ChatContainer`.
 *
 * @param confidence Nivel de confianza reportado por la fuente.
 * @param isDarkMode Indica si los estilos deben aplicarse para tema oscuro.
 */
export const getConfidenceBadgeStyles = (confidence: number, isDarkMode: boolean) => {
  if (confidence >= 90) {
    return isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700';
  } else if (confidence >= 70) {
    return isDarkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-700';
  } else {
    return isDarkMode ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-100 text-orange-700';
  }
};
