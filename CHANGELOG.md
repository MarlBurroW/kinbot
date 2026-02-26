# Changelog

All notable changes to KinBot are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Installer `--backup` and `--restore` commands for database management
- Mobile-friendly model picker and context usage display in conversation header
- Right-click context menu on chat messages (copy, quote reply, regenerate)
- Language label and line numbers on code blocks
- Use cases section with 6 scenario cards (landing site)
- Floating back-to-top button on landing site
- Ollama-first install messaging and visibility improvements (landing site)
- InfoTips on MCP server form fields and General Settings
- Elapsed time counter on typing/thinking indicator
- Docker Compose tab in install section (landing site)
- Section group headers in settings sidebar
- Scroll-to-bottom floating button in conversation view
- Getting started checklist on welcome screen
- Live relative timestamps on messages ("2m ago") with absolute on hover
- Keyboard shortcuts help dialog (press `?` to open)
- Copy message to clipboard button on hover
- Dedicated Channels section on landing site
- PR template and SECURITY.md

### Fixed
- SSE event handlers for webhooks settings page
- Provider count updated (19 → 22) and channel list in README

### Changed
- Extracted shared LanguageSelector component
- Upgraded empty states in memories and notification settings to use EmptyState component
- Replaced hardcoded strings with `t()` calls in channels, webhooks, contacts, vault (i18n)
- Translated theme palette switcher and notification test button

### CI
- Multi-platform Docker builds (amd64 + arm64) with OCI labels
- Dependabot config for automated dependency updates (npm, GitHub Actions, Docker)
- Bumped actions/checkout to v6, actions/cache to v5, actions/upload-pages-artifact to v4
- Added Docker build & push workflow with release changelog output
- Added build & test workflow on push/PR

### Installer
- Bun version validation and auto-upgrade

### Tests
- Ollama provider tests
- OpenAI provider (classifyModel, testConnection, listModels)
- Custom-tools service (path validation, name regex, JSON Schema → Zod)

---

## [0.2.23] - 2026-02-25

### Added
- **Matrix channel adapter** — Client-Server API with /sync long-polling and typing indicator
- `--dry-run` mode for the installer
- Contextual help tooltips to Kin and Cron forms

### Fixed
- License in structured data (MIT → AGPL-3.0)
- Added Signal to channel references on landing site

## [0.2.22] - 2026-02-25

### Added
- **Signal channel adapter** — via signal-cli REST API with webhook support
- Animated stats section on landing site
- Contextual help hints to Kin character and expertise fields

### Tests
- Auth middleware tests (30 tests, path-skipping + session validation)

## [0.2.21] - 2026-02-25

### Added
- **WhatsApp channel adapter** — Business Cloud API with webhook verification

## [0.2.20] - 2026-02-25

### Added
- Confirmation dialogs for destructive delete actions
- Installer pre-flight checks (disk space, port, connectivity)

### Fixed
- Migration ordering + Kin deletion FK failures
- Updated landing site copy from branding audit (provider counts, channels, hero, CTA)

## [0.2.19] - 2026-02-25

### Added
- **Slack channel adapter** — Events API webhook + Web API with signature verification

## [0.2.18] - 2026-02-25

### Added
- **Discord channel adapter** — Gateway WebSocket + REST API with message splitting and typing indicator
- Search provider selection — global default + per-Kin override
- Command palette (`Cmd+K`) for quick navigation
- `--help` and `--status` flags for the installer
- Active section highlighting + mobile hamburger menu on landing site

### Fixed
- Various provider fixes

## [0.2.17] - 2026-02-25

### Added
- **Perplexity provider** — search + AI synthesis
- `@lobehub/icons` for provider icons
- Rich empty states with icons, descriptions, and action buttons
- `run_once` support for one-shot crons
- Proactive wake-up system (`wake_me_in` tool)
- Live GitHub stats badges in hero section (landing site)

### Fixed
- Trigger owner LLM turn when cron-spawned task fails

### Tests
- ToolRegistry (register, resolve, list, availability filtering)

## [0.2.16] - 2026-02-25

### Added
- **Serper provider** — Google SERP API
- Nomic, Replicate, Stability AI, FAL providers on landing site

## [0.2.15] - 2026-02-25

### Added
- **FAL AI provider** — fast inference for Flux and other models
- FAQ overhaul with positioning-driven content (landing site)

### Tests
- Web-browse service (SSRF, content extraction, link parsing)

## [0.2.14] - 2026-02-25

### Added
- **Stability AI provider** — Stable Diffusion API

### Changed
- Rewrote README with punchy tagline, scannable features, and streamlined quick start

## [0.2.13] - 2026-02-25

### Added
- **Replicate provider** — multi-model image generation (Flux, SDXL, etc.)
- GitHub CTA section with live star count (landing site)
- Centralized provider metadata as single source of truth

### Tests
- Shared/constants (provider derivations, tool domains, static arrays)

## [0.2.12] - 2026-02-25

### Added
- **Nomic provider** — open-source embeddings
- Improved SEO meta tags, Open Graph, and Twitter cards (landing site)

### Fixed
- Provider icons — use colored logos, remove `dark:invert`, add Jina AI

## [0.2.11] - 2026-02-25

### Added
- **Jina AI provider** — embeddings and reranking
- Scroll-reveal animations on landing site
- Website link in README

### Tests
- Provider registry and OpenAI model classification

## [0.2.10] - 2026-02-25

### Added
- **Tavily provider** — search API optimized for AI
- xAI provider references on landing site and README

## [0.2.9] - 2026-02-25

### Added
- **xAI (Grok) provider** — OpenAI-compatible API

### Tests
- Prompt-builder (buildSystemPrompt)

## [0.2.8] - 2026-02-25

### Added
- **Cohere provider** — LLM + embeddings + rerank
- Comparison table vs ChatGPT, Open WebUI, LibreChat (landing site)

## [0.2.7] - 2026-02-25

### Added
- **OpenRouter provider** — multi-provider aggregator

### Tests
- Encryption service

## [0.2.6] - 2026-02-25

### Added
- **Ollama provider** — local models, no API key required
- Changelog section with live GitHub releases (landing site)

## [0.2.5] - 2026-02-25

### Added
- **DeepSeek provider** — OpenAI-compatible API
- FAQ section with accordion (landing site)

### Tests
- Test framework setup and slug utility tests

## [0.2.4] - 2026-02-25

### Added
- **Fireworks AI provider** — OpenAI-compatible fast inference
- Providers section with logos and capability badges (landing site)

## [0.2.3] - 2026-02-25

### Added
- **Together AI provider** — open-source models

## [0.2.2] - 2026-02-25

### Added
- **Groq provider** — ultra-fast inference

## [0.2.1] - 2026-02-25

### Added
- **Mistral AI provider** — native API with /v1/models

## [0.2.0] - 2026-02-25

### Added
- Configurable extraction and embedding models via UI
- `--uninstall` flag for install.sh

---

[Unreleased]: https://github.com/MarlBurroW/kinbot/compare/v0.2.23...HEAD
[0.2.23]: https://github.com/MarlBurroW/kinbot/compare/v0.2.22...v0.2.23
[0.2.22]: https://github.com/MarlBurroW/kinbot/compare/v0.2.21...v0.2.22
[0.2.21]: https://github.com/MarlBurroW/kinbot/compare/v0.2.20...v0.2.21
[0.2.20]: https://github.com/MarlBurroW/kinbot/compare/v0.2.19...v0.2.20
[0.2.19]: https://github.com/MarlBurroW/kinbot/compare/v0.2.18...v0.2.19
[0.2.18]: https://github.com/MarlBurroW/kinbot/compare/v0.2.17...v0.2.18
[0.2.17]: https://github.com/MarlBurroW/kinbot/compare/v0.2.16...v0.2.17
[0.2.16]: https://github.com/MarlBurroW/kinbot/compare/v0.2.15...v0.2.16
[0.2.15]: https://github.com/MarlBurroW/kinbot/compare/v0.2.14...v0.2.15
[0.2.14]: https://github.com/MarlBurroW/kinbot/compare/v0.2.13...v0.2.14
[0.2.13]: https://github.com/MarlBurroW/kinbot/compare/v0.2.12...v0.2.13
[0.2.12]: https://github.com/MarlBurroW/kinbot/compare/v0.2.11...v0.2.12
[0.2.11]: https://github.com/MarlBurroW/kinbot/compare/v0.2.10...v0.2.11
[0.2.10]: https://github.com/MarlBurroW/kinbot/compare/v0.2.9...v0.2.10
[0.2.9]: https://github.com/MarlBurroW/kinbot/compare/v0.2.8...v0.2.9
[0.2.8]: https://github.com/MarlBurroW/kinbot/compare/v0.2.7...v0.2.8
[0.2.7]: https://github.com/MarlBurroW/kinbot/compare/v0.2.6...v0.2.7
[0.2.6]: https://github.com/MarlBurroW/kinbot/compare/v0.2.5...v0.2.6
[0.2.5]: https://github.com/MarlBurroW/kinbot/compare/v0.2.4...v0.2.5
[0.2.4]: https://github.com/MarlBurroW/kinbot/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/MarlBurroW/kinbot/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/MarlBurroW/kinbot/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/MarlBurroW/kinbot/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/MarlBurroW/kinbot/releases/tag/v0.2.0
