# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- English README with badges; the Spanish version moved to `README.es.md`.
- Community files: code of conduct, issue and pull request templates, and this
  changelog.
- Error messages and toasts are now translated in the four supported interface
  languages (Spanish, English, French, German).
- Prompt caching on OpenRouter: Anthropic requests send automatic
  `cache_control`, every request carries a per-chat `session_id` for sticky
  routing, and the history window only moves in steps so the request prefix
  stays identical between turns. Cached-token usage is logged per request.
- Warnings when a response is cut by the token limit, and a clear message for
  insufficient OpenRouter credits (HTTP 402).
- Model catalog refreshes itself in the background once it is a day old.

### Fixed

- Responses were capped at 2048 tokens, below the reasoning budget itself, so
  long answers were truncated and reasoning models could return nothing. The
  output limit now includes the reasoning budget of the selected level.
- The web search context no longer breaks the cached prompt prefix.
- "Resend message" on a user message failed with "cannot regenerate".
- Errors sent inside the stream (provider drops mid-response) are now reported
  instead of ending the response silently.
- Switching the interface language now updates already rendered messages.
- Chats created while the history was still loading could be lost.

### Changed

- Internal refactor: a single chat store (the active chat is derived from its
  id), a subscribable model catalog, one record mapper for IndexedDB, and an
  `App` composed from focused hooks. Unused profile/usage-limit fields from the
  former hosted version were removed.

- Local persistence moved from a single localStorage key to IndexedDB, removing
  the ~5MB storage limit. Existing data is migrated automatically on first load
  and a backup copy is kept in localStorage.

## [1.0.0] - 2026-06-20

### Added

- Initial release: local-first chat client with OpenRouter streaming, model
  catalog, JSON import/export, image attachments, visible reasoning, optional
  web search (Tavily/Brave), and local folder backup.
