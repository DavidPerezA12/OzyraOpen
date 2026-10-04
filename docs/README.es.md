# Ozyra Open en corto

**English: [README.md](README.md)**

## Stack

- Vite, React 18 y TypeScript estricto.
- Persistencia local en IndexedDB mediante `src/utils/db.ts` (con migración
  automática desde el antiguo formato de `localStorage`).
- OpenRouter directo desde el navegador en `src/services/openrouter`.
- Tests con Vitest y Testing Library.

## Flujo principal

1. `src/App.tsx` orquesta chats, preferencias y generación.
2. `src/hooks/useAppBootstrap.ts` carga perfil, conversaciones y modelos.
3. `src/services/chatService.ts` prepara la llamada a OpenRouter.
4. El stream actualiza el borrador del asistente y separa respuesta de
   razonamiento.
5. `src/utils/db.ts` guarda mensajes y metadatos en IndexedDB, en el navegador.

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
fallback SPA a `index.html` si usas rutas internas. El workflow
`deploy-pages.yml` publica una demo en GitHub Pages una vez actives Pages en los
ajustes del repo (Source: GitHub Actions).

Antes de publicar revisa `VITE_OPENROUTER_SITE_URL`, `VITE_SITE_URL` y las claves
opcionales de búsqueda. Recuerda que cualquier variable `VITE_` queda expuesta al
frontend.

Sirve estas cabeceras HTTP (la CSP en `<meta http-equiv>` de `index.html` no
puede aplicar `frame-ancestors`):

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://openrouter.ai https://api.tavily.com https://api.search.brave.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
```

Nunca definas `VITE_TAVILY_API_KEY` / `VITE_BRAVE_SEARCH_API_KEY` (ni ningún
secreto compartido) en un build público: los valores `VITE_` viajan dentro de
`dist/*.js` en texto claro. Solo es seguro fijar
`VITE_OPENROUTER_BASE_URL=https://openrouter.ai/api/v1` (cualquier otro valor lo
rechaza la allowlist en runtime).

## Problemas rápidos

- Falta clave: guárdala en `Ajustes > Perfil local`.
- Búsqueda web directa sin resultados: revisa el proveedor elegido y su API key.
- Modelos sin sincronizar: la app usa catálogo fallback y puede seguir arrancando.
- Datos rotos: exporta lo recuperable y limpia las claves `ozyrachat:*` en
  DevTools (localStorage) y la base `ozyrachat-local-db` (IndexedDB).
