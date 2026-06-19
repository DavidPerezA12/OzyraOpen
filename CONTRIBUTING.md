# Contributing

Thanks for helping improve Ozyra Open.

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Store provider keys from the local settings UI when possible. Any `VITE_` value
is public in the built frontend.

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
