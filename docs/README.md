# Ozyra Open in short

**Español: [README.es.md](README.es.md)**

## Stack

- Vite, React 18, and strict TypeScript.
- Local persistence in IndexedDB through `src/utils/db.ts` (with automatic
  migration from the old `localStorage` format).
- OpenRouter called directly from the browser in `src/services/openrouter`.
- Tests with Vitest and Testing Library.

## Main flow

1. `src/App.tsx` orchestrates chats, preferences, and generation.
2. `src/hooks/useAppBootstrap.ts` loads the profile, conversations, and models.
3. `src/services/chatService.ts` prepares the OpenRouter call.
4. The stream updates the assistant draft and separates the response from the
   reasoning.
5. `src/utils/db.ts` stores messages and metadata in IndexedDB, in the browser.

## Data and privacy

Ozyra Open is local-first: chats, profile, preferences, and counters live in
the browser. The optional folder copy writes `ozyrachat-data.json` and excludes
the OpenRouter, Tavily, and Brave Search keys.

Keys configured from the UI remain accessible to JavaScript on that origin. To
publish a public instance with shared keys you need your own rate-limiting and
security layer.

## Development

```bash
npm run dev         # local server
npm run type-check  # TypeScript
npm run lint        # ESLint
npm run test        # Vitest
npm run validate    # all of the above
npm run knip        # unused files and dependencies
npm run build       # production build
```

## Deployment

Generate `dist/` with `npm run build` and upload it to any static hosting.
Configure an SPA fallback to `index.html` if you use internal routes. The
`deploy-pages.yml` workflow publishes a demo to GitHub Pages once Pages is
enabled in the repo settings (Source: GitHub Actions).

Before publishing, review `VITE_OPENROUTER_SITE_URL`, `VITE_SITE_URL`, and the
optional search keys. Remember that any `VITE_` variable is exposed to the
frontend.

Serve these HTTP headers (the `<meta http-equiv>` CSP in `index.html` cannot
enforce `frame-ancestors`):

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://openrouter.ai https://api.tavily.com https://api.search.brave.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
```

Never set `VITE_TAVILY_API_KEY` / `VITE_BRAVE_SEARCH_API_KEY` (or any shared
secret) in a public build: `VITE_` values ship inside `dist/*.js` in clear
text. Only `VITE_OPENROUTER_BASE_URL=https://openrouter.ai/api/v1` is safe to
bake in (any other value is rejected at runtime by the allowlist).

## Quick troubleshooting

- Missing key: save it in `Settings > Local profile`.
- Direct web search returns nothing: check the chosen provider and its API key.
- Models not synced: the app uses a fallback catalog and can keep running.
- Broken data: export what you can recover, then clear `ozyrachat:*` keys in
  DevTools (localStorage) and the `ozyrachat-local-db` database (IndexedDB).
