# Changelog

All notable changes to KinBot are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Context** — add temporal metadata to compacting summary section
- **Context** — smart token-based history truncation instead of hard message limit
- **Context** — add multi-user conversation guidance to system prompt
- **Mini Apps** — fix inter-app data sharing via shared-data events

### Fixed
- **Account** — close modal on save, show toast, and persist i18n language
- **E2E** — correct lucide icon class name for XCircle, resolve strict mode violations

### Changed
- **Performance** — lazy-load MiniAppViewer, QuickChatPanel, rehype-highlight, remark-math, rehype-katex on demand
- **Performance** — memoize sidebar components and stabilize derived prop references
- **i18n** — replace hardcoded strings in MessageBubble, KinFormModal, VaultAttachmentList
- **Site** — add dedicated Privacy & Security section, performance hints

---

## [0.19.3] - 2026-03-11

### Added
- **Memory** — automated stale memory pruning after compacting
- **Memory** — improve consolidation quality: abort false merges, cap cluster size, preserve details
- **Sessions** — client-side session expiry awareness (#201)

### Fixed
- **Chat** — replace undefined `handleQuickStart` with `createSession` in ChatPanel
- **Chat** — show fallback UI when quick session closes via SSE (#200)
- **Chat** — show loading skeleton instead of empty state when switching kins
- **Memory** — prevent save-as-memory with empty summary (#199)
- **Tests** — add missing `pruneStaleMemories` to memory mock

### Changed
- **CI** — add Bun dependency caching to migrations and store-plugins workflows
- **Docs** — add stale memory pruning documentation
- **Docs** — add session expiry details to Quick Sessions API reference
- **Docs** — add memory consolidation section with abort/cluster-cap details

---

## [0.19.2] - 2026-03-10

### Added
- **Memory** — add `sourceContext` field for conversational context

### Fixed
- **i18n** — fix missing accents in French logs translations

### Changed
- **CI** — increase E2E CI timeout from 15 to 30 minutes
- **Docs** — document `sourceContext` field in memory extraction
- **Docs** — add Documentation link to README nav bar
- **Docs** — fix Kins overview accuracy: priority queue, compacting, provider field

---

## [0.19.1] - 2026-03-09

### Added
- **E2E** — add conversation search spec (27-conversation-search)

### Fixed
- **Plugins** — clean up partial registrations on activation failure, add lifecycle timeouts
- **Security** — server-side validation for password length, avatar size, and order arrays (#196, #197, #198)
- **Docs** — fix unused SparkLine import in examples page
- **Docs** — fix getting-started `useKinBot`/`useStorage` accuracy vs actual JS SDK

---

## [0.19.0] - 2026-03-09

### Added
- **Logs** — backend logs viewer in settings UI (#179)
- **Mini Apps** — forward console/errors to Kin for debugging (#178)
- **Crons** — one-shot (`run_once`) support in cron form UI (#171)
- **Kins** — per-Kin compacting thresholds + compaction proximity UI (#173)
- **Plugins** — `check_plugin_updates` and `update_plugin` AI tools
- **Plugins** — topological sort for plugin activation order
- **E2E** — add conversation statistics popover spec (26-conversation-stats)
- **Tests** — add tests for home-automation, system-monitor store plugins, knowledge `chunkText`

### Fixed
- **Chat** — resolve auto-scroll race conditions with queued messages (#172)
- **Crons** — stop cron jobs on kin delete (#168, #169, #170)
- **MCP** — env merge in Kin tool, allow empty env values in form (#193, #194, #195)
- **Plugins** — bust import cache on hot-reload; track tool errors in health system
- **Plugins** — add missing `compactingConfig` to KinRecord interface
- **Contacts** — sub-resource validation, duplicate identifiers, N+1 queries, revoke confirmation
- **Security** — webhooks security and reliability fixes
- **Tests** — multiple mock and type fixes for CI stability

### Changed
- **Deps** — bump docker actions (buildx v4, qemu v4, login v4, metadata v6, setup-node v6)
- **Deps** — bump `@lobehub/icons` to 5.0.1, `lucide-react` to 0.577.0

---

## [0.18.0] - 2026-03-08

### Added
- **Plugins** — integrate remote registry into marketplace with tabbed UI
- **Plugins** — export validation for plugin init return values
- **Chat** — display message queue above input with delete support
- **E2E** — add keyboard shortcuts dialog spec (25-keyboard-shortcuts)
- **Tests** — add tests for notification-delivery service

### Fixed
- **Chat** — restore auto-scroll when queue preview resizes the viewport
- **Chat** — use cached context tokens from last LLM call for accurate display
- **Mini Apps** — properly close panel when app is deleted via SSE
- **Messages** — include source metadata in streaming SSE events (#167)
- **Messages** — add redacted message visual indicator and reaction error handling (#164, #165)
- **Files** — delete orphaned files from disk when clearing conversation (#166)
- **Plugins** — add health reset button and uninstall for store plugins
- **Plugins** — improve update checks for git and npm sources
- **Providers** — support OpenRouter, DeepSeek, and other OpenAI-compatible providers for LLM resolution

### Changed
- **Memory** — use raw vector distance for dedup instead of full search pipeline
- **Installer** — skip rebuild when nothing changed (fast re-run)
- **Docs** — add knowledge base/RAG to features, fix comparison table
- **Docs** — fix SDK reference accuracy against `kinbot-sdk.d.ts`

---

## [0.17.0] - 2026-03-08

### Added
- **Memory** — query intent detection for category-aware score boosting
- **Memory** — surface retrieval relevance score in prompt context
- **Tools** — `wake_me_every` tool for recurring wakeups
- **Tools** — filesystem tools (read, write, edit, list) with custom renderers (#130)
- **Plugins** — dependency management, version compatibility checking, config value validation
- **Contacts** — UI to manually add platform IDs (#135)
- **Contacts** — search/filter UI for contacts and webhooks lists (#136, #137)
- **Crons** — show running indicator on cards and jobs tab (#152)
- **Sessions** — pagination for quick session history (#150)
- **Chat** — enlarge avatars with clickable preview
- **Store** — add currency-converter plugin
- **E2E** — add command palette spec (23-command-palette)
- **Installer** — add `--health` command for monitoring integration
- **Tests** — add tests for system-info, filesystem, world-clock, calendar, currency-converter, history tools

### Fixed
- **Onboarding** — progress bar, language persistence, validation, recovery (#153-#156)
- **Plugins** — `await` async init functions; update always re-activates disabled plugins; SSE events for enable/disable/config
- **MCP** — double `/api` prefix, error handling, length limits, env hints, account counters (#139-#143)
- **Sessions** — N+1 query, content length limit, `fileIds` validation (#146-#148)
- **Sessions** — reset close dialog state, responsive quick chat width (#149, #151)
- **Memory** — normalize relevance scores relative to top result
- **Contacts** — server-side validation limits, surface fetch errors in UI (#131-#134)
- **Providers** — update capabilities on successful test
- **Avatar** — raise upload limit to 10MB safety net (#144)
- **Context** — fetch token usage on kin selection

### Changed
- **Sidebar** — enlarge kin items for better usability
- **Refactor** — extract shared `toastError` utility, deduplicate 39 call sites
- **i18n** — translate hardcoded strings in tool result renderers
- **Docs** — update built-in tools list to 120+ tools, fix hooks accuracy, add plugin system to architecture
- **CI** — add missing PR labeler rules and release-drafter categories

---

## [0.15.0] - 2026-03-07

### Added
- **Knowledge** — knowledge base / RAG backend (#110)
- **Memory** — tune hybrid search defaults (ftsBoost 1.2→0.5, decay floor 0.3→0.7)
- **Tools** — limit `prompt_human` to 1 call per LLM turn (#112)
- **Store** — add dictionary plugin (define, synonyms, antonyms)
- **Sessions** — quick session history to view past conversations (#72)
- **Chat** — persist message drafts to localStorage (#82)
- **Contacts** — warn about cascading platform access revocation on delete (#87)
- **Contacts** — add Kin selector in contact form for kin-type contacts (#84)
- **Crons** — show target Kin info in detail modal (#75), next 3 run times in form (#77)
- **Webhooks** — rate limiting on incoming endpoint (#91), visual distinction for inactive webhooks (#93)
- **MCP** — connection status indicator and test button (#97)
- **Account** — password change (#103), member since date (#104)
- **Hub** — Hub Kin designation UI and sidebar search improvements
- **E2E** — expand general settings spec with hub kin, help panel, escape close tests
- **CI** — add migration test workflow (fresh DB + idempotency + FK check), release-drafter
- **Tests** — add tests for inter-kin, webhook, kin-management, image, browse, human-prompt, pomodoro tools

### Fixed
- **Security** — admin check on user deletion, avatar upload validation, profile input validation, token masking (#100-#102, #105)
- **Security** — hardening + settings UX improvements (#118-#122)
- **MCP** — unicode sanitization and connection pool resilience (#98, #99)
- **Providers** — support OpenAI-compatible providers (OpenRouter, etc.) for config generation and avatar prompts (#106)
- **Contacts** — return 409 conflict for already-linked user (#86); include `platformIds` in detail response (#88)
- **Mini Apps** — inherit reduced contrast mode from parent (#108)
- **Avatar** — show feedback on upload failure (#107)
- **Webhooks** — log retention and periodic cleanup (#90)
- **Chat** — server-side message length validation (#83)
- **Sessions** — cascade FK, validation, expiration check, error handling for quick sessions
- **Tests** — fix `mock.module` pollution, mini-app gallery text mismatch

### Changed
- **Mini Apps** — remove clone feature (#111)
- **Installer** — resilient build with auto-cleanup on failure
- **Docs** — rewrite API Reference with complete REST endpoints and accurate SSE events
- **Docs** — accuracy review: providers section, plugin registration example

---

## [0.14.0] - 2026-03-06

### Added
- **Docs** — migrate Kins section (overview, system prompts, tools, memory)
- **Docs** — add Channels section (overview + 6 platform guides)
- **Docs** — add Memory, Providers, and API Reference sections
- **Docs** — aurora theme with glass effects, gradient accents, background orbs, and component overrides
- **Docs** — sidebar, hero, footer, pageframe overrides + glass cards, TOC, inline code, blockquotes
- **Memory** — add `review_memories` tool for memory health auditing
- **Store** — add calendar plugin with event management and scheduling
- **Tools** — add `get_mini_app_docs` tool, slim down `create_mini_app` description (#66)
- **E2E** — add chat message input spec (formatting toolbar, shortcuts, multiline)
- **E2E** — add plugins settings and marketplace spec
- **Tests** — add tests for webhook-tools, kin-management-tools, image-tools
- **Community** — add FUNDING.yml, community section in README, update sitemap
- **Installer** — add `--cron` command for automatic update scheduling
- **GitHub** — enable Discussions with templates

### Fixed
- **Docs** — fix plugin docs accuracy: remove phantom APIs, correct REST routes, add password config type
- **Docs** — fix theme contrast and dark/light modes
- **Tests** — fix `mock.module` pollution causing 9 test file load errors
- **Site** — add `.nojekyll` to fix `_astro` assets on GitHub Pages

---

## [0.13.0] - 2026-03-06

### Added
- **Plugins** — add password config field type for sensitive values
- **Store** — add home-automation plugin for Home Assistant integration
- **Store** — add github-notifications plugin
- **Memory** — contextual query rewriting for short/ambiguous messages
- **Memory** — enrich recall and `list_memories` tool output with importance and age
- **Tools** — add plugin management tools for Kins (#68)
- **UI** — add Run Now button to cron detail modal (#74)
- **Docs** — migrate Plugins section (overview, developing, API, store)
- **Docs** — migrate Mini-Apps section (8 pages)
- **Tests** — add tests for contact-tools, prompt-builder helper functions
- **Site** — add Tech Stack section showcasing core technologies
- **CI** — add `workflow_dispatch` and trigger on validator changes for store-plugins

### Fixed
- **Cron** — handle silent fetch errors in cron history, allow clearing optional fields (#73, #76)
- **UI** — remove model picker from quick chat to prevent global model changes (#71)
- **Session** — fix quick session memory embedding, expired session SSE, gallery clone UX
- **E2E** — handle both empty states in mini-app gallery test
- **Tests** — fix 11 failing tests + 2 module errors caused by bun `mock.module` pollution

---

## [0.12.0] - 2026-03-05

### Added
- **Docs** — scaffold Starlight documentation site, migrate Getting Started content
- **Store** — add bookmarks plugin, system-monitor plugin
- **Mini Apps** — add Kanban drag-and-drop board, DateRangePicker, Calendar component
- **Memory** — bump default embedding dimension from 768 to 1536
- **Docs** — expand README comparison table with ChatGPT, OpenClaw, and CrewAI
- **Tests** — add tests for settings routes, database-tools, inter-kin service, web-browse service
- **Site** — add Plugin Store showcase with real community plugins
- **Installer** — expand `--config` wizard with log level and encryption key

### Fixed
- **Plugins** — add defensive null checks for plugin data in Settings (#61, #62)

### Changed
- **CI** — update store-plugins checkout to v6, add `plugins/store` labels to labeler

---

## [0.11.1] - 2026-03-05

### Added
- **Mini Apps** — add MarkdownEditor, ColorPicker, Combobox & TagInput, hash-based routing components
- **Memory** — subject-based score boosting for query-relevant memories
- **Store** — add RSS reader plugin, pomodoro timer plugin
- **UI** — Store tab in Plugin Marketplace (#57)
- **Plugins** — add store install API endpoints (#56)
- **Onboarding** — add quick finish option to skip memory & search steps (#35)
- **CI** — add store plugin validation workflow and script (#60)
- **Docs** — add store plugin contributing guide and scaffolding script (#53)
- **Tests** — add tests for cron-tools, invitations, rate limiter, wakeup-tools, kinAvatarUrl
- **E2E** — fix onboarding spec: update step 3 button text, reduce flakiness
- **Installer** — add `--completions` for bash/zsh/fish, enhance `--status` with version/health/disk info

### Fixed
- **Docker** — add entrypoint to fix volume permissions for non-root user
- **Security** — run Docker container as non-root user
- **Tests** — fix mock collision in task-tools causing cron-tools test failure
- **Site** — fix Plugins section layout, dark-on-dark/light-on-light theme issue, missing FAQ property

### Changed
- **Plugins** — use PasswordInput for secret plugin config fields
- **CI** — consolidate duplicate PR templates into one

---

## [0.11.0] - 2026-03-04

### Added
- **Plugins** — Phase 1 MVP plugin system (#41)
- **Plugins** — Phase 2: provider and channel registration from plugins
- **Mini Apps** — add responsive layout template, `useBreakpoint` hook, responsive CSS utilities, `useLocalStorage` hook
- **Memory** — reduce default embedding dimension to 768 (50% storage savings)
- **Tests** — add tests for SSE manager, user-tools, memory tools, shared constants
- **Installer** — extract categorized changelog into reusable function
- **Docs** — add plugin system to README features, comparison table, and project structure

### Changed
- **Memory** — extract unified MemoryModelConfig component

---

## [0.10.1] - 2026-03-04

### Added
- **Mini Apps** — add TypeScript type definitions for SDK, React hooks, and components
- **Mini Apps** — upgrade form template with `useAsync` + backend submission + history tab
- **Memory** — improve extraction prompt precision with durability guidance
- **Tests** — add tests for notification-delivery (formatting, rate limiting, avatar URL)
- **E2E** — expand provider management spec with test-all, cancel, and type switching tests
- **UI** — cron form validation feedback and timezone display (#38, #40)
- **Installer** — add lockfile to prevent concurrent runs

### Fixed
- **SSE** — add missing events for MCP server mutations via Kin tools

---

## [0.10.0] - 2026-03-04

### Added
- **Tools** — add `http_request` tool for generic HTTP calls (#34)
- **Tools** — add `get_system_info` tool with system info in prompt (#33)
- **Tools** — add `trigger_cron` tool to run crons immediately (#32)
- **Mini Apps** — add API Explorer template, data-browser template, `useInfiniteScroll`/`usePagination`/`useFetch`/`useApi`/`useAsync`/`useEventStream` hooks, `KinBot.download()` for file export
- **Memory** — subject-based memory grouping in prompts, importance auto-recalibration, contradiction-aware extraction + subject-partitioned consolidation
- **UI** — improve onboarding UX with user-friendly model explanations (#35), reduce contrast mode (#36)
- **Tests** — add tests for webhooks service, http-request-tools, mini-app-backend, kin-engine, mini-app-templates
- **E2E** — expand login spec with session persistence, logout, error recovery tests
- **Docs** — update README with new tools and bump tool count to 100+
- **Installer** — group `--help` output into logical categories, add resource monitoring to `--status`

### Fixed
- **SSE** — add missing events for `setContactNote` upsert
- **i18n** — add missing mention notification type translations (#37)
- **Kins** — allow setting slug during creation (#31)
- **Security** — security, UX, and model filtering fixes (#25, #26, #27, #28)
- **Zod** — update `z.record()` calls to Zod 4 two-arg syntax

### Changed
- **CI** — remove duplicate PR template, add security advisory link to issue config

---

## [0.9.0] - 2026-03-03

*No detailed changelog available — see [commit history](https://github.com/MarlBurroW/kinbot/compare/v0.8.1...v0.9.0) for full details.*

---

## [0.8.1] - 2026-03-02

### Added
- **Mini Apps** — add Chat Interface and Settings Panel templates
- **Mini Apps** — add DataGrid component with sorting, filtering, pagination & selection
- **Context** — add tool usage strategy guidance to system prompt
- **CI** — add E2E tests job (Playwright)
- **Tests** — add tests for attach-file-tool staging API

### Changed
- **Performance** — lazy-load provider icons via dynamic imports

### Fixed
- **E2E** — stabilize file storage delete test with explicit waits
- **a11y** — add aria-label to file storage edit button for E2E test accessibility

### Removed
- **Branding** — remove branding and promo from repo (keep local, internal strategy)

---

## [0.8.0] - 2026-03-02

### Added
- **Channels** — add `attach_file` tool for Kins to send files in channel responses
- **Channels** — add outbound file attachment support to all adapters (Telegram, Discord, Slack, WhatsApp, Signal, Matrix)
- **Channels** — add file download/storage service for channel attachments
- **Channels** — auto-cleanup old channel files with configurable retention
- **Context** — add conversation participant awareness, response calibration, honesty and uncertainty guidance to system prompt
- **Context** — enrich context block with human-readable date and day of week
- **Context** — add importance and recency metadata to memory injection
- **Reactions** — add message reactions with emoji picker ([#20](https://github.com/MarlBurroW/kinbot/issues/20))
- **Memory** — add importance backfill utility and manual consolidation/backfill API endpoints
- **Memory** — show consolidation generation and importance badges on MemoryCard
- **Mini Apps** — add Form compound component with validation
- **Mini Apps** — add Grid, Breadcrumbs, Popover components + `KinBot.shortcut()` API
- **Mini Apps** — add `KinBot.apps`, `KinBot.conversation`, `KinBot.share` APIs (SDK v1.14.0)
- **Mini Apps** — add `KinBot.memory.search()` and `KinBot.memory.store()` SDK APIs
- **Mini Apps** — add `KinBot.kin`, `KinBot.user`, `KinBot.resize()`, `KinBot.notification()`
- **Mini Apps** — comprehensive CSS animations & transitions library
- **PWA** — add Progressive Web App support ([#15](https://github.com/MarlBurroW/kinbot/issues/15))
- **Tests** — add tests for crons service, cron utilities, channel adapter utilities, encryption, client API module, human-prompts validation

### Fixed
- **SSE** — emit events for cross-kin FK nullifications on kin deletion, contact sub-entities, and quick-session type
- **CI** — fix labeler i18n path and add mini-apps/security labels
- Various type errors and E2E test stabilization fixes

### Changed
- **Performance** — wrap chat components in `React.memo`, lazy-load CronDetailModal, TaskDetailModal, CronFormModal, KinFormModal, SettingsModal, AccountDialog
- **Dependencies** — bump actions/labeler from 5 to 6 ([#21](https://github.com/MarlBurroW/kinbot/pull/21))
- **Site** — add post-install journey timeline, 5 new FAQ entries

---

## [0.7.0] - 2026-03-01

### Added
- **Context** — move compacting summary from fake messages to system prompt for cleaner context
- **Context** — add platform-specific formatting guide for external channels
- **Health check** — version and uptime in `/api/health` response ([#18](https://github.com/MarlBurroW/kinbot/issues/18))
- **Kin export/import** — export and import Kin configurations ([#17](https://github.com/MarlBurroW/kinbot/issues/17))
- **Memory** — add memory consolidation, merge near-duplicate memories via LLM
- **Tasks** — cross-kin task notifications and `get_task_detail` tool
- **Chat** — add infinite scroll pagination for older messages
- **Mini Apps** — add React component library (`@kinbot/components`)
- **Mini Apps** — rewrite templates to use `@kinbot/components` library
- **Mini Apps** — refactor templates, SDK improvements, and task title support
- **CI** — add automated showcase video generation for landing site
- **CI** — record E2E test videos and publish report to GitHub Pages
- **Tests** — add tests for consolidation service, search service
- **i18n** — add task assignment and chat pagination translation keys

### Fixed
- **Chat** — instant scroll to bottom when switching Kins (force remount + two-phase scroll)
- **Chat** — remove auto-collapse on long messages
- **SSE** — serialize SSE writes to prevent stream interleaving
- **Tasks** — robust streaming init and polling fallback in task detail
- **Tasks** — show typing indicator and handle streaming in task detail modal
- **E2E** — resolve 4 failing E2E tests
- **a11y** — add missing DialogDescription to suppress Radix warnings

### Changed
- **Performance** — add React.lazy code splitting for all page components
- **Performance** — add manual chunk splitting to reduce main bundle size by 57%
- **Installer** — harden Docker Compose with resource limits, log rotation, and security options
- **Site** — add CI/E2E/CodeQL quality badges to GitHubCTA section

---

## [0.6.0] - 2026-03-01

### Added
- **Hub Kin** — new Hub Kin concept with routing, onboarding rework, and account dialog
- **Mini Apps: `KinBot.sendMessage()`** — SDK API for app-to-Kin communication
- **Mini Apps: `KinBot.ready()` promise** — returns app metadata on resolution
- **Mini Apps: `KinBot.locale` API** — i18n-aware mini apps
- **Mini Apps: template parameter** — `create_mini_app` tool now accepts a template
- **Memory: importance scoring** — memories now have an importance score
- **Memory: improved FTS5 query building** — prefix matching and AND/OR fallback
- **Channels: `IncomingAttachment`** — attachments field on `IncomingMessage`
- **Installer** — `--changelog` command to preview changes before updating
- Auto-labeler workflow for PRs
- CrewAI/AutoGPT positioning in comparison table (site)

### Fixed
- Scroll freeze in chat with memoization and `startTransition`
- Dialog gap styling
- E2E test stability (strict mode violations, vault select-trigger scoping)
- Consolidate duplicate PR templates

### Changed
- Troubleshooting and security links in site footer
- Animated terminal install sequence in Hero section (site)
- Simplified WhatIsKin diagram (site)

---

## [0.5.0] - 2026-02-28

### Added
- **Built-in tools reference** — 90+ tools documented in README
- **Mini Apps: App Gallery** — browse community apps and clone them into your Kins with one click
- **Mini Apps: `KinBot.http()` server-side proxy** — external API requests from sandboxed apps
- **Mini Apps: snapshot/rollback tools** — Kins can snapshot and rollback mini app state
- **Mini Apps: storage tools** — `get`/`set`/`delete`/`list`/`clear` persistent key-value storage
- **Mini Apps: real-time SSE events** — backend-to-frontend event streaming
- **Mini Apps: responsive breakpoints** — `sm`/`md`/`lg` CSS utility classes
- **Mini Apps: base tag** — relative path resolution in multi-file apps
- **Mini Apps: Additional SDK components** — select, checkbox, switch, radio, progress, alert, avatar, kbd, spinner CSS classes
- **Memory: temporal decay** — time-based scoring in memory search
- **@mention system** — autocomplete, styled pills, and notifications
- **E2E Tests** — channel management, Kin management, settings, contacts, webhooks, search providers, vault
- **Installer** — `--start`/`--stop`/`--restart` for service lifecycle; `--doctor` diagnostic report; `--yes`/`-y` non-interactive mode; self-update check; HTTPS/encryption key hints; `config`/`env`/`restore`/`reset` subcommands; `--logs` with grep/since filtering
- Comparison table in README
- Husky pre-commit hooks (typecheck + tests + build)
- Badge `size="xs"` variant
- Pull request template and CODEOWNERS
- Dependabot monitoring for `site/` dependencies
- Concurrency groups to cancel superseded workflow runs
- Cached Playwright browsers in E2E workflow

### Fixed
- Guard `config.tasks` access in prompt-builder to prevent CI failures
- Read `PUBLIC_URL` from env on update, fixing empty URL in summary ([#9](https://github.com/MarlBurroW/kinbot/issues/9))
- Remove husky prepare script in Docker production stage (bun ignores `HUSKY=0`)
- Translate hardcoded Close button and URL label (i18n)
- SSE events for MCP servers, quick-session memories, contacts, webhooks now properly emitted
- Race condition in memory deletion
- Type error in `useMentionables`
- E2E test stability improvements across multiple specs

### Changed
- Add Compare link to navbar (site)
- Circular scroll progress indicator on back-to-top button (site)
- Interactive cost estimator, cross-platform context demo, autonomy demo on site
- Shared `ProviderSelector` and `FormErrorAlert` components
- Minimal `EmptyState` variant replacing inline dashed empty states

---

## [0.4.2] - 2026-02-28

### Added
- **Mini Apps: `KinBot.openApp(slug)` for inter-app navigation** — apps can now navigate users to other mini apps
- **Mini Apps: `KinBot.clipboard.write/read`** for clipboard access from sandboxed iframes
- **Mini Apps: Layout utility classes** in SDK CSS (Tailwind-like)
- **Onboarding: Dedicated Memory step** for embedding model configuration
- **Installer: `--doctor` command** for diagnostic reports
- Playwright E2E tests for onboarding, login, and chat
- Unit tests for onboarding routes and notification-delivery service
- Dependency-review workflow for PR security checks
- E2E and CodeQL badges in README
- Elapsed time tracking in installer install/update/reset summaries
- Search and category filtering to FAQ section (site)
- Live commit count and open issues to stats (site)

### Fixed
- SSE events for MCP servers and quick-session memories now properly emitted
- Remove duplicate ALTER TABLE statements in migrations 0026 and 0027
- Move pino-pretty to dependencies (needed at runtime in logger.ts)
- E2E test stability improvements (provider delete, edit, route mocks)
- Installer now refreshes apt cache before first package install

### Changed
- Extract shared `FormErrorAlert` component for consistent form error display
- Translate hardcoded strings in sidebar and chat panel (i18n)
- Optimize bundle splitting for faster initial load (site)
- Fix provider count in architecture diagram

---

## [0.4.1] - 2026-02-28

### Added
- **Mini Apps: `KinBot.setTitle()` and `KinBot.setBadge()` SDK APIs** for dynamic window title and notification badges
- **Mini Apps: Starter templates** for quick app scaffolding
- Tests for files service (`serializeFile`, `getExtension`, `uploadFile` validation)
- SoftwareApplication and WebSite JSON-LD structured data for SEO (site)
- Command palette (⌘K) for quick section navigation (site)
- Container environment detection in installer preflight checks
- Log rotation for script-based service manager (installer)

### Fixed
- SSE events for contacts (create/update/delete) now properly emitted

### Changed
- Updated architecture diagram with channels, mini-apps, and 22+ providers
- Extract shared time formatting utilities into `lib/time.ts`

---

## [0.4.0] - 2026-02-28

### Added
- **Mini Apps: Backend API support** — Mini Apps can now include a `_server.js` for server-side logic
- **Mini Apps: `KinBot.confirm()` and `KinBot.prompt()` dialog APIs** for interactive user input
- **Mini Apps: Import map support** via `app.json` manifest
- **Mini Apps: Full-page mode** with maximize/minimize toggle
- **Mini Apps: CSP headers and security hardening** for iframe sandbox
- Comprehensive troubleshooting guide (`TROUBLESHOOTING.md`)
- Interactive hover effects with per-card accent colors and cursor-tracking glow on Features section (site)
- Dot grid background pattern to hero section (site)
- Gradient section dividers between key sections (site)
- Interactive demo section with simulated chat scenarios (site)
- Capability filter to providers section (site)
- Custom tools and mini apps rows to comparison table (site)
- Score summary cards and KinBot column highlight to comparison section (site)
- Live GitHub stars and forks to stats section (site)
- Comprehensive environment variables reference to README
- Screenshots to README for better GitHub first impression
- `--env` flag to installer for listing config and removing variables
- CodeQL security analysis workflow (CI)
- Docker build validation to CI workflow

### Changed
- Rewrite channel descriptions from technical specs to user benefits (site)
- Replace cosmetic feature cards with Mini Apps and Custom Tools (site)
- Replace fake demo with real video gallery (site)
- Remove fake testimonials section (site)
- Remove "Meanwhile, cloud AI" comparison from pricing (site)
- Remove focus mode feature

### Fixed
- Emit SSE events for mini-apps on kin cascade deletion
- Emit `memory:deleted` SSE events during kin cascade deletion
- Docker: bind to `0.0.0.0` and add compose healthcheck
- Installer: fix `local` keyword used outside functions in generated service script
- Cast mock fetch through unknown in `jina.test.ts`

### Tests
- Add tests for Signal, Matrix, WhatsApp, Slack, and Discord channel adapters
- Add tests for Tavily, Replicate, Voyage, Nomic, and Serper providers

---

## [0.3.0] - 2026-02-27

### Added
- **Mini Apps** — Kins can create embedded web apps
- **"What's New" changelog dialog** accessible from sidebar version badge
- Search/filter field in the Kin list sidebar
- Toast notifications when background tasks complete or fail
- Right-click context menu on Kin cards with edit and delete actions
- Auto-scroll toggle button in conversation view
- Download code block as file button
- Token estimates on Kin character and expertise prompt fields
- Activity sparkline in conversation statistics popover
- Next run countdown display on cron cards and detail modal
- Enhanced sidebar empty states with icons and action buttons
- Contextual help tooltips to file storage form
- Memory/swap pre-flight check in installer
- ErrorBoundary string translations (i18n)
- Interactive demo section showcasing memory feature (site)
- "How it works" step-by-step onboarding section (site)
- Channel request issue template
- `--quiet/-q` mode for scripted/automated installs
- Installer: diagnose startup failures with actionable hints

### Changed
- Use KinSelector in MemoryList, add `noneValue` prop
- Extract shared ProviderSelector component
- Show provider error message on card when connection is unhealthy
- Fix French translations (opt-in, chat shortcut, accents)
- Remove em-dashes from EN and FR translations

### Fixed
- Docker: install build tools before `bun install` for better-sqlite3 node-gyp
- Resolve TypeScript errors in mini-apps domain icon and Buffer type
- Correct fetch mock type cast in `fal.test.ts`
- Resolve type errors in cohere provider tests
- Fix EventBus test handler return types

### Tests
- Add tests for Cohere, Groq, FAL AI providers
- Add tests for EventBus (services/events)

---

## [0.2.25] - 2026-02-27

### Added
- Focus mode for distraction-free chat with hidden sidebar & header (`Ctrl+Shift+F`)
- Conversation statistics popover with message breakdown, tool calls, duration, and response time
- Markdown formatting toolbar with keyboard shortcuts (Bold, Italic, Strikethrough, Code)
- Input history: press Up/Down arrow to cycle through previously sent messages
- New message count badge on scroll-to-bottom button when scrolled up
- Highlight matching text within messages during conversation search
- Wrap/unwrap toggle for long code blocks
- Clear conversation button with confirmation dialog
- "Get API key" help links in provider setup dialog
- Contextual help panels to Providers, Memories, Contacts, Users, Channels, and Search Providers settings
- Step progress indicators to install flow
- `--config` flag to installer for reconfiguring port and URL interactively
- Retry with exponential backoff for network operations in installer
- Vault field type label translations (i18n)
- Formatting & search shortcuts to keyboard shortcuts dialog
- Favicon notification badge with unread count when tab is in background
- Unread message count badge in browser tab title when tab is hidden
- Real-time toast notifications for provider/channel status changes
- Reading time estimate for long assistant messages
- Sticky date separators while scrolling conversation history
- Scroll-to-top button for quick navigation to conversation start
- Contextual help panel to General Settings page
- `--test` self-test mode for installation validation
- `--reset` to installer for fixing broken installations without losing data
- "Test All" button to provider settings pages
- Screenshots to README for better first impression

### Fixed
- Docker: remove unsupported `--production=false` flag from `bun install`
- Installer: fix shellcheck warnings and backup/restore arg parsing
- Resolve all TypeScript errors and enforce typecheck in CI/release
- Add missing `perplexity` to ProviderType union

### Changed
- Use `PasswordInput` in VaultEntryFormDialog for consistency
- Extract shared `useCopyToClipboard` hook and `useModels` hook
- Consolidate duplicate PR templates
- Improve docker-compose with image default, comments, and `PUBLIC_URL` hint
- Use curated CHANGELOG.md in release notes instead of raw git log

### Tests
- Add tests for Mistral, Together AI, Fireworks AI providers and Telegram channel adapter
- Add tests for Perplexity provider
- Add tests for compacting service (token estimation, keep/summarize split, JSON parsing, snapshot cleanup)

### Site
- Add screenshots gallery section with lightbox viewer (keyboard nav, touch swipe, image preloading)
- Add accessibility improvements (reduced motion, skip-to-content, ARIA)
- Add rotating tagline animation to Hero section
- Staggered scroll animations for Features & Providers grids
- SEO: robots.txt, sitemap.xml, refined meta description and structured data
- Add OpenClaw to comparison table with new feature rows
- Add scroll progress indicator to navbar

### CI
- Add stale issues & PRs workflow for repo hygiene
- Add PRs Welcome badge and GitHub topics

---

## [0.2.24] - 2026-02-27

### Added
- Unsaved changes protection to Kin and Cron form dialogs
- Auto-scroll toggle button in conversation view
- Read aloud button for assistant messages (Web Speech API)
- Edit & resend user messages via hover button and context menu
- Search within conversation messages (Ctrl+F)
- Export conversation as Markdown or JSON
- Collapse/expand long messages with gradient fade and toggle
- Date separators between messages from different days
- Message grouping for consecutive messages from same sender
- Full-area drag-and-drop file upload overlay on chat panel
- Auto-focus message input on kin switch + Escape to refocus
- Character count indicator in message input
- Right-click context menu on chat messages (copy, quote reply, regenerate)
- Copy message to clipboard button on hover
- Notification sound chime with toggle in preferences
- `notify` tool and `kin:alert` notification type
- Real context usage tracking + visible LLM error handling
- System health bar in sidebar showing provider/channel status
- Enhanced typing indicator with kin avatar and chat bubble style
- Elapsed time counter on typing/thinking indicator
- Live relative timestamps on messages ("2m ago") with absolute on hover
- Keyboard shortcuts for kin navigation (Cmd+1-9, Cmd+Shift+N, Cmd+,)
- Keyboard shortcuts help dialog (press `?` to open)
- Keyboard shortcut badges on kin cards in sidebar
- Language label and line numbers on code blocks
- API key reveal toggle in provider form
- Duplicate cron button in job detail modal
- Search/filter field in crons list
- Scroll-to-bottom floating button in conversation view
- Getting started checklist on welcome screen
- Chat empty state with kin avatar, greeting, and suggestion chips
- InfoTips across provider, channel, webhook, contact, MCP, and settings forms
- Contextual help panels to advanced settings pages
- Section group headers in settings sidebar
- System info footer in settings modal (version, uptime, stats)
- Sidebar footer with settings, shortcuts hints, and version
- Connection-lost banner when SSE disconnects
- Connection status indicator to channel cards
- Mobile-friendly model picker and context usage display in conversation header
- Responsive settings modal with mobile dropdown navigation
- Skeleton loading states to all settings pages
- Password visibility toggle to login, onboarding, and invite pages
- KinBot logo across UI
- Platform awareness, delegation & initiative to Kin system prompt
- PR template, SECURITY.md, Code of Conduct, CONTRIBUTING.md
- Installer: `--backup`/`--restore`, `--update`, `--docker`, `--version`, `--logs`, `--no-color` flags
- Installer: WSL detection, animated spinners, rollback on failure, auto-backup before updates, post-start health check, signal handling

### Fixed
- SSE events for webhooks, provider CRUD, channel cascade deletion, and kin deletion cascades
- Avatar generated preview in AvatarPickerModal on open
- Auth login error handling in useAuth
- SVG icons for Slack, WhatsApp, Signal, Matrix platforms
- Docker CI: `latest` tag never applied on release pushes

### Changed
- Replaced README screenshots with video demo
- Improved card action consistency and added ProviderIcon to search provider selector
- Redesigned vault secret card with colored type icons
- Improved notification read/unread visual distinction
- Improved welcome screen when no kin is selected
- Extracted shared components: KinSelector, LanguageSelector, useProviders, useKinList hooks
- Used PasswordInput component for all secret/password fields
- Upgraded empty states in memories and notification settings

### i18n
- Extracted last hardcoded slug placeholder
- Replaced hardcoded error strings with `t()` calls across channels, webhooks, contacts, vault
- Fixed untranslated French strings, missing accents, 'Francais' typo
- Translated 'Channels' to 'Canaux', theme palette switcher, notification test button

### CI
- TypeScript type-check step (non-blocking)
- Multi-platform Docker builds (amd64 + arm64) with OCI labels
- Dependabot config (npm, GitHub Actions, Docker)
- Bumped actions/checkout to v6, actions/cache to v5, actions/upload-pages-artifact to v4
- Bun dependency caching across all workflows

### Site
- Multi-column footer layout with nav, resources & community links
- Standardized provider count to 23
- Responsive comparison section with mobile card view
- Improved architecture section with animated connectors and icons
- Code-split with React.lazy + manual chunks
- Replaced mock chat with preview1.mp4 video in Hero
- Use cases section, FAQ structured data, Perplexity provider card
- Favicon, web manifest, OG/Twitter preview image, brain logo
- Added AnythingLLM to comparison table

### Tests
- Groq, xAI, Anthropic, Gemini, OpenRouter, DeepSeek, Ollama, OpenAI providers
- Server config module, HookRegistry, MCP service, log-store service
- Custom-tools service, shared/provider-metadata

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

[Unreleased]: https://github.com/MarlBurroW/kinbot/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/MarlBurroW/kinbot/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/MarlBurroW/kinbot/compare/v0.4.2...v0.5.0
[0.4.2]: https://github.com/MarlBurroW/kinbot/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/MarlBurroW/kinbot/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/MarlBurroW/kinbot/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/MarlBurroW/kinbot/compare/v0.2.25...v0.3.0
[0.2.25]: https://github.com/MarlBurroW/kinbot/compare/v0.2.24...v0.2.25
[0.2.24]: https://github.com/MarlBurroW/kinbot/compare/v0.2.23...v0.2.24
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
