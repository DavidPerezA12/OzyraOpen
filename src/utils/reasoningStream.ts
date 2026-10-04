const THINKING_OPEN = '<thinking>';
const THINKING_CLOSE = '</thinking>';

export type ReasoningChunkResult = {
  responseDelta: string;
  thinkingDelta: string;
  isReasoning: boolean;
};

export function splitReasoningChunk(chunk: string, wasReasoning: boolean): ReasoningChunkResult {
  let index = 0;
  let isReasoning = wasReasoning;
  let responseDelta = '';
  let thinkingDelta = '';

  while (index < chunk.length) {
    if (isReasoning) {
      const closeIndex = chunk.indexOf(THINKING_CLOSE, index);

      if (closeIndex === -1) {
        thinkingDelta += chunk.slice(index);
        index = chunk.length;
      } else {
        thinkingDelta += chunk.slice(index, closeIndex);
        index = closeIndex + THINKING_CLOSE.length;
        isReasoning = false;
      }
      continue;
    }

    const openIndex = chunk.indexOf(THINKING_OPEN, index);
    const closeIndex = chunk.indexOf(THINKING_CLOSE, index);
    const hasStrayClose = closeIndex !== -1 && (openIndex === -1 || closeIndex < openIndex);

    if (hasStrayClose) {
      responseDelta += chunk.slice(index, closeIndex);
      index = closeIndex + THINKING_CLOSE.length;
      continue;
    }

    if (openIndex === -1) {
      responseDelta += chunk.slice(index);
      index = chunk.length;
    } else {
      responseDelta += chunk.slice(index, openIndex);
      index = openIndex + THINKING_OPEN.length;
      isReasoning = true;
    }
  }

  return {
    responseDelta,
    thinkingDelta,
    isReasoning,
  };
}

export function stripReasoningMarkers(text: string): string {
  return text.split(THINKING_OPEN).join('').split(THINKING_CLOSE).join('');
}

/**
 * Escapa marcadores literales que vengan del CONTENIDO del modelo.
 *
 * El stream mezcla en la misma banda los marcadores emitidos por la app
 * (`<thinking>`/`</thinking>`) con el texto del modelo. Sin escape, un
 * modelo (o un prompt inyectado) que escriba `<thinking>` voltea el parser
 * (`splitReasoningChunk`) y oculta el resto de la respuesta en el bloque
 * plegable de razonamiento. Se sustituyen por entidades HTML, que Markdown
 * renderiza como el texto literal original.
 */
export function escapeThinkingMarkers(text: string): string {
  return text
    .split(THINKING_OPEN)
    .join('&lt;thinking&gt;')
    .split(THINKING_CLOSE)
    .join('&lt;/thinking&gt;');
}
