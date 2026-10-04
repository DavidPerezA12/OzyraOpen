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

### Changed

- Local persistence moved from a single localStorage key to IndexedDB, removing
  the ~5MB storage limit. Existing data is migrated automatically on first load
  and a backup copy is kept in localStorage.

## [1.0.0] - 2026-06-20

### Added

- Initial release: local-first chat client with OpenRouter streaming, model
  catalog, JSON import/export, image attachments, visible reasoning, optional
  web search (Tavily/Brave), and local folder backup.
