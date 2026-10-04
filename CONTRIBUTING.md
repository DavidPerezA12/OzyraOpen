# Contributing

Thanks for helping improve Ozyra Open. Issues and pull requests are welcome,
whether it is a bug fix, a new feature, a translation, or better docs.

## Local Setup

Requirements: Node.js 20+ and npm 10+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Store provider keys from the local settings UI when possible. Any `VITE_` value
is public in the built frontend.

## How the code is organized

- `src/App.tsx` — top-level orchestrator; wires hooks, services, and UI.
- `src/hooks/` — stateful logic (bootstrap, generation, navigation, editing).
- `src/services/openrouter/` — OpenRouter client, streaming, payload building.
- `src/services/chat/` — generation pipeline, persistence, regeneration.
- `src/services/search/` — optional direct web search (Tavily / Brave).
- `src/utils/db.ts` — local persistence layer (all data stays in the browser).
- `src/components/` — React components, grouped by area.
- `src/i18n.ts` — all user-facing strings, in the four supported languages.

A compact architecture guide lives in [docs/README.md](docs/README.md).

## Guidelines

- **User-facing strings go through `src/i18n.ts`.** Add the key to all four
  languages (es, en, fr, de). In components use the `t` prop; in hooks and
  services import `t` from `src/i18n`.
- **Keep the app local-first.** No backends, accounts, or telemetry. Data and
  keys stay in the user's browser.
- **Add tests** for new logic in services, hooks, and utils. Components with
  meaningful behavior deserve tests too.
- Match the existing code style; Prettier and ESLint enforce most of it.

## Checks

Run this before opening a pull request:

```bash
npm run validate
npm run test:coverage
npm run build
npm run knip
npm audit --omit=dev
```

The pre-commit hook runs `npm run validate`.

## Pull requests

- Keep PRs focused: one change per PR is easier to review and revert.
- Describe what the change does and why; link the related issue if there is
  one.
- CI must pass before merge.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be kind.
