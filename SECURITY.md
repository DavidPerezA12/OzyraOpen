# Security Policy

Ozyra Open is a local-first browser client. Chats, preferences and API keys are
stored in the user's browser, and model/search requests are sent directly from
that browser to the configured providers.

Do not put shared production secrets in `VITE_` variables. They are bundled into
the frontend and are visible to anyone using that build.

If you find a vulnerability, please open a private report through GitHub Security
Advisories when available, or contact the maintainer privately before publishing
details.
