# Ozyra Open en corto

## Stack

- Vite, React 18 y TypeScript estricto.
- Persistencia local en `localStorage` mediante `src/utils/db.ts`.
- OpenRouter directo desde el navegador en `src/services/openrouter`.
- Tests con Vitest y Testing Library.

## Flujo principal

1. `src/App.tsx` orquesta chats, preferencias y generación.
2. `src/hooks/useAppBootstrap.ts` carga perfil, conversaciones y modelos.
3. `src/services/chatService.ts` prepara la llamada a OpenRouter.
4. El stream actualiza el borrador del asistente y separa respuesta de
   razonamiento.
5. `src/utils/db.ts` guarda mensajes y metadatos en el navegador.

## Datos y privacidad

Ozyra Open es local-first: chats, perfil, preferencias y contadores viven en el
navegador. La copia opcional a carpeta escribe `ozyrachat-data.json` y excluye
las claves de OpenRouter, Tavily y Brave Search.

Las claves configuradas desde la UI siguen siendo accesibles para JavaScript en
ese origen. Para publicar una instancia pública con claves compartidas hace falta
una capa propia de límites y seguridad.

## Desarrollo

```bash
npm run dev         # servidor local
npm run type-check  # TypeScript
npm run lint        # ESLint
npm run test        # Vitest
npm run validate    # todo lo anterior
npm run knip        # archivos y dependencias sin uso
npm run build       # build de producción
```

## Despliegue

Genera `dist/` con `npm run build` y súbelo a un hosting estático. Configura
fallback SPA a `index.html` si usas rutas internas.

Antes de publicar revisa `VITE_OPENROUTER_SITE_URL`, `VITE_SITE_URL` y las claves
opcionales de búsqueda. Recuerda que cualquier variable `VITE_` queda expuesta al
frontend.

## Problemas rápidos

- Falta clave: guárdala en `Ajustes > Perfil local`.
- Búsqueda web directa sin resultados: revisa el proveedor elegido y su API key.
- Modelos sin sincronizar: la app usa catálogo fallback y puede seguir arrancando.
- Datos rotos: exporta lo recuperable y limpia claves `ozyrachat:*` en DevTools.
