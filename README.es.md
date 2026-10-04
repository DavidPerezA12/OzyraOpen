# Ozyra Open

[![CI](https://github.com/DavidPerezA12/OzyraOpen/actions/workflows/ci.yml/badge.svg)](https://github.com/DavidPerezA12/OzyraOpen/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**English: [README.md](README.md)**

Chat local-first con React, TypeScript y OpenRouter.

Ozyra Open guarda tus conversaciones en el navegador y llama a los modelos desde
el cliente. No necesita Supabase, login ni una base de datos propia.

## Capturas

![Pantalla principal de Ozyra Open](docs/assets/ozyra-open-home.jpg)

![Ajustes locales de Ozyra Open](docs/assets/ozyra-open-settings.jpg)

## Qué ofrece

- Conversaciones locales con importación y exportación en JSON.
- Streaming de respuestas desde OpenRouter.
- Selector de modelos con catálogo local y sincronización opcional.
- Markdown, adjuntos de imagen, razonamiento visible y búsqueda web opcional.
- Copia local a carpeta cuando el navegador soporta File System Access API.
- Interfaz disponible en español, inglés, francés y alemán.

## Arranque

Requisitos: Node.js 20+, npm 10+ y una clave de OpenRouter.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abre `http://localhost:5173` y guarda la clave en `Ajustes > Perfil local`.

## Seguridad

Las variables `VITE_` y cualquier clave guardada desde la UI viven en el
navegador. Usa esta app como cliente local-first: no metas secretos privados en
`.env.local` que no quieras exponer al frontend.

Las claves opcionales de Tavily o Brave Search también viven en el navegador.
Para una instancia pública compartida conviene usar claves con límites de gasto o
añadir un backend propio con cuotas. Consulta [SECURITY.md](SECURITY.md) para la
política de reporte de vulnerabilidades.

## Scripts

```bash
npm run dev
npm run validate
npm run build
```

`validate` ejecuta type-check, lint, formato y tests.

## Contribuir

¡Las contribuciones son bienvenidas! Consulta [CONTRIBUTING.md](CONTRIBUTING.md)
para la configuración local, los checks y las guías de pull request.

## Más

La guía compacta está en [docs/README.es.md](docs/README.es.md).

MIT License. Consulta [LICENSE](LICENSE).
