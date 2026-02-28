<div align="center">

# KinBot

**AI agents that actually remember you.**

Self-hosted. Persistent memory. Real collaboration.

[![CI](https://github.com/MarlBurroW/kinbot/actions/workflows/ci.yml/badge.svg)](https://github.com/MarlBurroW/kinbot/actions/workflows/ci.yml)
[![GitHub Release](https://img.shields.io/github/v/release/MarlBurroW/kinbot?style=flat-square&color=a855f7)](https://github.com/MarlBurroW/kinbot/releases)
[![GitHub Stars](https://img.shields.io/github/stars/MarlBurroW/kinbot?style=flat-square&color=ec4899)](https://github.com/MarlBurroW/kinbot)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg?style=flat-square)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://github.com/MarlBurroW/kinbot/pkgs/container/kinbot)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://github.com/MarlBurroW/kinbot/pulls)

[Website](https://marlburrow.github.io/kinbot/) · [Quick Start](#-quick-start) · [Features](#-features) · [Compare](#-how-does-kinbot-compare) · [Architecture](#-architecture) · [Changelog](CHANGELOG.md) · [Contributing](#contributing)

</div>

## Why KinBot?

Most AI tools treat every conversation as **disposable**. You explain yourself Monday, they forget by Tuesday.

KinBot is different. You create **Kins** — AI agents with:

| | |
|---|---|
| 🧠 **Persistent memory** | They remember every conversation. Forever. Vector search + full-text across months of interactions. |
| 🎭 **Real identity** | Name, role, personality, avatar. They know who they are and who you are. |
| 🤝 **Collaboration** | Kins talk to each other, delegate tasks, spawn workers. A team, not a chatbot. |
| ⚡ **Autonomy** | Cron jobs, webhooks, Telegram. They work while you sleep. |
| 🏠 **Self-hosted** | One process. One SQLite file. Your data never leaves your server. |

> *"Like having your own team of AI specialists that live on your server and never forget a thing."*

---


<div align="center">

<video src="docs/screenshots/preview1.mp4" autoplay loop muted playsinline width="720"></video>

</div>


## ✨ Features

### 🧠 Intelligence
Persistent memory (vector + full-text) · Session compacting · Sub-agents · Inter-Kin communication · Continuous sessions that never reset

### 🔧 Automation & Extensibility
Cron jobs · Webhooks · 6 channels (Telegram, Discord, Slack, WhatsApp, Signal, Matrix) · MCP servers · Custom tools · Mini Apps · Contacts · Notifications · Human-in-the-loop prompts · 23 AI providers (incl. Ollama) · Multi-provider auto-detection

### 🔒 Security & Privacy
AES-256-GCM vault · Auth with roles · Invitation system · 100% self-hosted · Your data never leaves your server

### 🎨 Experience
8 color palettes · Dark/Light/System themes · English & French · File uploads · Image generation · Real-time SSE streaming

<details>
<summary><strong>Full feature list</strong></summary>

#### Kins
- **Persistent identity** — each Kin has a name, description, character, expertise domain, model, and avatar
- **Continuous sessions** — one session per Kin, never resets
- **Shared Kins** — all users on the instance interact with the same Kins; messages are tagged with sender identity

#### Intelligence
- **Long-term memory** — dual-channel: automatic extraction pipeline on every LLM turn + explicit `remember()` tool; hybrid search (vector similarity + full-text)
- **Session compacting** — automatic summarization to stay within token limits; original messages are always preserved, snapshots are rollback-able
- **Sub-Kins (tasks)** — Kins can delegate work to ephemeral sub-agents; `await` mode re-enters the parent queue with the result, `async` mode deposits it as informational
- **Inter-Kin communication** — request/reply pattern with correlation IDs; rate-limited; replies are always informational (no ping-pong)

#### Automation
- **Cron jobs** — in-process scheduler (croner); Kins can create their own crons (with user approval); searchable/filterable cron list; cron results appear in the main session
- **Webhooks** — inbound webhooks to trigger Kins from external systems; configurable per-Kin
- **Channels** — 6 platforms: Telegram, Discord, Slack, WhatsApp, Signal, Matrix
- **Notifications** — Kins can send push notifications to users via the `notify` tool
- **Human-in-the-loop** — Kins can prompt users for approval before sensitive actions (cron creation, MCP server management, etc.)

#### Security & Privacy
- **Vault** — AES-256-GCM encrypted secrets; never exposed in prompts or logs; message redaction prevents leaking into compacted summaries
- **Authentication** — Better Auth with HTTP-only cookie sessions; admin + member roles; invitation system
- **Self-hosted** — your data never leaves your server

#### Extensibility
- **MCP servers** — connect any Model Context Protocol server to extend Kins with external tools; Kins can manage their own MCP connections
- **Custom tools** — Kins can create, register, and run their own scripts from their workspace
- **Mini Apps** — Kins can build and deploy interactive web apps (HTML/CSS/JS) that live in the sidebar; auto-injected design system + JavaScript SDK with theme sync, toasts, navigation, and parent-child event communication
- **Contacts** — manage contacts that Kins can reference and interact with
- **Multi-provider** — 23 providers: Anthropic, Anthropic OAuth, OpenAI, Gemini, Mistral, DeepSeek, Groq, Together AI, Fireworks AI, Ollama, OpenRouter, Cohere, xAI, Voyage AI, Jina AI, Nomic, Tavily, Serper, Perplexity, Replicate, Stability AI, FAL AI, Brave Search

#### Experience
- **8 color palettes** — Aurora, Ocean, Forest, Sunset, Monochrome, Sakura, Neon, Lavender
- **Dark / Light / System** theme modes
- **Internationalization** — English and French
- **File uploads** — share files with Kins; image generation supported
- **Real-time streaming** — SSE-based, multiplexed across all Kins on a single connection
- **Responsive UI** — mobile-friendly settings, contextual info tips, suggestion chips in empty chat states
- **System info** — version, uptime, and stats visible in settings

</details>

> **🔍 How does KinBot compare?** See the [detailed feature comparison](https://marlburrow.github.io/kinbot/#comparison) with Open WebUI, LobeChat, AnythingLLM, and others.

---

## 🚀 Quick Start

```bash
docker run -d --name kinbot -p 3000:3000 -v kinbot-data:/app/data ghcr.io/marlburrow/kinbot:latest
```

Open `http://localhost:3000` — done. The onboarding wizard handles the rest.

<details>
<summary><strong>Other install methods</strong> (one-liner script, Docker Compose, manual)</summary>

### One-liner install (Linux / macOS)

```bash
curl -fsSL https://raw.githubusercontent.com/MarlBurroW/kinbot/main/install.sh | bash
```

This script will:
1. Install [Bun](https://bun.sh) if not already present
2. Clone the repository to `/opt/kinbot`
3. Install dependencies and build the frontend
4. Run database migrations
5. Create a system service (systemd on Linux, launchd on macOS)
6. Start KinBot on port **3000**

**Customizable via env vars:**
```bash
KINBOT_DIR=/home/me/kinbot \
KINBOT_DATA_DIR=/home/me/kinbot-data \
KINBOT_PORT=8080 \
  bash <(curl -fsSL https://raw.githubusercontent.com/MarlBurroW/kinbot/main/install.sh)
```

### Docker Compose

```bash
git clone https://github.com/MarlBurroW/kinbot.git
cd kinbot/docker
ENCRYPTION_KEY=$(openssl rand -hex 32) docker compose up -d
```

See [`docker/docker-compose.yml`](docker/docker-compose.yml) for full options.

### Manual

```bash
git clone https://github.com/MarlBurroW/kinbot.git
cd kinbot
bun install
bun run build
bun run db:migrate
NODE_ENV=production bun run start
```

</details>

---

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                   KinBot  (single process)                    │
│                                                               │
│  ┌──────────────────┐      ┌───────────────────────────────┐  │
│  │  React + Vite    │      │        Hono REST API          │  │
│  │  Tailwind 4      │◀────▶│        + SSE stream           │  │
│  │  shadcn/ui       │      └──────────────┬────────────────┘  │
│  └──────────────────┘                     │                   │
│                                           │                   │
│              ┌────────────────────────────┤                   │
│              │            │               │                   │
│    ┌─────────▼──┐  ┌──────▼────┐  ┌───────▼─────┐             │
│    │  Vercel    │  │  Queue    │  │   Croner    │             │
│    │  AI SDK    │  │  (FIFO)   │  │  (Cron jobs)│             │
│    │  Kin Engine│  │  per Kin  │  └─────────────┘             │
│    └────────────┘  └───────────┘                              │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │           SQLite  (bun:sqlite + Drizzle ORM)            │  │
│  │           + FTS5 (full-text search)                     │  │
│  │           + sqlite-vec (vector similarity)              │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
          │                                         │
  AI Providers                              External world
  Anthropic, OpenAI,                        Telegram, Webhooks,
  Gemini, Voyage AI                         MCP servers
```

**Key design principles:**
- **Queue per Kin** — one message processed at a time per Kin; user messages have priority over automated ones
- **Global SSE** — one SSE connection per browser tab, multiplexed by `kinId`; no per-Kin polling
- **No message deletion** — compacting summarizes, never deletes; original messages always preserved
- **Secrets stay in the vault** — vault secrets are never exposed in prompts; redaction prevents leaking into summaries

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | [Bun](https://bun.sh) |
| **Backend** | [Hono](https://hono.dev), [Drizzle ORM](https://orm.drizzle.team), bun:sqlite, [sqlite-vec](https://github.com/asg017/sqlite-vec), [Vercel AI SDK](https://sdk.vercel.ai), [Better Auth](https://www.better-auth.com), [croner](https://github.com/Hexagon/croner) |
| **Frontend** | [React 19](https://react.dev), [Vite](https://vite.dev), [Tailwind CSS 4](https://tailwindcss.com), [shadcn/ui](https://ui.shadcn.com), [i18next](https://www.i18next.com) |
| **AI Providers** | Anthropic, OpenAI, Gemini, Mistral, DeepSeek, Groq, Together AI, Fireworks AI, Ollama, OpenRouter, Cohere, xAI, Voyage AI, Jina AI, Nomic, Tavily, Serper, Perplexity, Replicate, Stability AI, FAL AI, Brave Search |
| **Database** | SQLite (single file) + FTS5 + sqlite-vec |

---

## Configuration

Copy `.env.example` to `.env` and adjust as needed. All values have sensible defaults — you can start with an empty `.env`.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3333` | HTTP server port |
| `HOST` | `127.0.0.1` | Bind address (`0.0.0.0` to expose on all interfaces) |
| `KINBOT_DATA_DIR` | `./data` | Persistent data directory (DB, uploads, workspaces) |
| `ENCRYPTION_KEY` | *(auto-generated)* | 64-char hex key for AES-256-GCM vault encryption. Auto-generated and persisted to `data/.encryption-key` on first run. |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `PUBLIC_URL` | `http://localhost:3333` | Public-facing URL (used in webhooks, invitation links) |

See [`.env.example`](.env.example) for the complete list of all options (compacting thresholds, memory tuning, queue settings, cron limits, web browsing, etc.).

---

## Development

### Prerequisites

- [Bun](https://bun.sh) >= 1.0
- Git

### Setup

```bash
git clone https://github.com/MarlBurroW/kinbot.git
cd kinbot
bun install
bun run dev    # Starts Vite dev server (port 5173) + Hono backend (port 3333)
```

The dev server proxies API requests from port 5173 to 3333 automatically.

### Commands

| Command | Description |
|---|---|
| `bun run dev` | Start dev servers (Vite + Hono with hot reload) |
| `bun run build` | Production build (Vite → `dist/client/`) |
| `bun run start` | Start production server |
| `bun run db:generate` | Generate a new Drizzle migration from schema changes |
| `bun run db:migrate` | Apply pending migrations to the SQLite database |

### Project structure

```
src/
  server/           # Bun + Hono backend
    routes/         # REST API routes (one file per resource)
    services/       # Business logic
    providers/      # AI provider implementations
    tools/          # Native tools exposed to Kins
    db/             # SQLite connection, Drizzle schema, migrations
    auth/           # Better Auth config + middleware
    sse/            # SSE manager
    config.ts       # Centralized configuration
  client/           # React + Vite frontend
    pages/          # Page components
    components/     # UI components (shadcn/ui + custom)
    hooks/          # Custom React hooks
    locales/        # i18n translation files (en.json, fr.json)
    styles/         # Design tokens + Tailwind config
  shared/           # Types and constants shared by client and server
    types.ts
    constants.ts
data/               # Created at runtime — SQLite DB, uploads, workspaces
docker/             # Dockerfile + docker-compose.yml
site/               # GitHub Pages landing site
```

### Adding a new language

1. Copy `src/client/locales/en.json` to `src/client/locales/<lang>.json`
2. Translate all values (keys must remain identical)
3. Register the language in `src/client/lib/i18n.ts`

---

## ⚙️ Environment Variables

All settings have sensible defaults. Override only what you need.

<details>
<summary><strong>Full configuration reference</strong></summary>

#### Core

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3333` | HTTP server port |
| `HOST` | `127.0.0.1` | Bind address (`0.0.0.0` to expose externally) |
| `NODE_ENV` | `development` | Set to `production` for optimized builds |
| `PUBLIC_URL` | `http://localhost:{PORT}` | Public-facing URL (for OAuth callbacks, webhooks) |
| `KINBOT_DATA_DIR` | `./data` | Data directory (DB, uploads, workspaces) |
| `ENCRYPTION_KEY` | Auto-generated | AES-256 key for vault encryption. Auto-generated and persisted on first run. Must be preserved across restarts. |
| `LOG_LEVEL` | `info` | Log verbosity: `debug`, `info`, `warn`, `error` |
| `DB_PATH` | `{dataDir}/kinbot.db` | SQLite database file path |

#### Memory & Compacting

| Variable | Default | Description |
|----------|---------|-------------|
| `COMPACTING_MESSAGE_THRESHOLD` | `50` | Messages before auto-compacting triggers |
| `COMPACTING_TOKEN_THRESHOLD` | `30000` | Token count before auto-compacting triggers |
| `COMPACTING_MODEL` | Provider default | Override the model used for session compacting |
| `COMPACTING_MAX_SNAPSHOTS` | `10` | Max compacting snapshots per Kin |
| `MEMORY_EXTRACTION_MODEL` | Provider default | Override the model used for memory extraction |
| `MEMORY_MAX_RELEVANT` | `10` | Max relevant memories injected into context |
| `MEMORY_SIMILARITY_THRESHOLD` | `0.7` | Minimum cosine similarity for memory retrieval |
| `MEMORY_EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model for memory vectors |
| `MEMORY_EMBEDDING_DIMENSION` | `1536` | Vector dimension for embeddings |

#### Tasks & Queues

| Variable | Default | Description |
|----------|---------|-------------|
| `QUEUE_POLL_INTERVAL` | `500` | Queue polling interval in ms |
| `TASKS_MAX_DEPTH` | `3` | Maximum sub-task nesting depth |
| `TASKS_MAX_REQUEST_INPUT` | `3` | Max concurrent task requests per input |
| `TASKS_MAX_CONCURRENT` | `10` | Max concurrent tasks globally |
| `TOOLS_MAX_STEPS` | `10` | Max tool call steps per LLM turn |

#### Cron & Automation

| Variable | Default | Description |
|----------|---------|-------------|
| `CRONS_MAX_ACTIVE` | `50` | Max active cron jobs |
| `CRONS_MAX_CONCURRENT_EXEC` | `5` | Max concurrent cron executions |

#### Inter-Kin Communication

| Variable | Default | Description |
|----------|---------|-------------|
| `INTER_KIN_MAX_CHAIN_DEPTH` | `5` | Max chain depth for Kin-to-Kin messages |
| `INTER_KIN_RATE_LIMIT` | `20` | Max inter-Kin messages per minute |

#### Channels & Webhooks

| Variable | Default | Description |
|----------|---------|-------------|
| `CHANNELS_MAX_PER_KIN` | `5` | Max channel connections per Kin |
| `WEBHOOKS_MAX_PER_KIN` | `20` | Max webhooks per Kin |
| `WEBHOOKS_MAX_PAYLOAD_BYTES` | `1048576` | Max webhook payload size (1 MB) |

#### File Storage & Uploads

| Variable | Default | Description |
|----------|---------|-------------|
| `UPLOAD_DIR` | `{dataDir}/uploads` | Upload directory |
| `UPLOAD_MAX_FILE_SIZE` | `50` | Max upload size in MB |
| `FILE_STORAGE_DIR` | `{dataDir}/storage` | Kin file storage directory |
| `FILE_STORAGE_MAX_SIZE` | `100` | Max file size in MB |
| `FILE_STORAGE_CLEANUP_INTERVAL` | `60` | Cleanup interval in minutes |

#### Vault

| Variable | Default | Description |
|----------|---------|-------------|
| `VAULT_ATTACHMENT_DIR` | `{dataDir}/vault` | Vault attachment directory |
| `VAULT_MAX_ATTACHMENT_SIZE` | `50` | Max attachment size in MB |
| `VAULT_MAX_ATTACHMENTS_PER_ENTRY` | `10` | Max attachments per vault entry |

#### Workspaces & Mini Apps

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKSPACE_BASE_DIR` | `{dataDir}/workspaces` | Kin workspace base directory |
| `MINI_APPS_DIR` | `{dataDir}/mini-apps` | Mini apps storage directory |
| `MINI_APPS_MAX_PER_KIN` | `20` | Max mini apps per Kin |
| `MINI_APPS_MAX_FILE_SIZE` | `5` | Max single file size in MB |
| `MINI_APPS_MAX_TOTAL_SIZE` | `50` | Max total size per app in MB |
| `MINI_APPS_BACKEND_ENABLED` | `true` | Enable mini app backend execution |

#### Web Browsing

| Variable | Default | Description |
|----------|---------|-------------|
| `WEB_BROWSING_PAGE_TIMEOUT` | `30000` | Page load timeout in ms |
| `WEB_BROWSING_MAX_CONTENT_LENGTH` | `100000` | Max extracted content length |
| `WEB_BROWSING_MAX_CONCURRENT` | `5` | Max concurrent fetches |
| `WEB_BROWSING_USER_AGENT` | KinBot default | Custom User-Agent string |
| `WEB_BROWSING_BLOCKED_DOMAINS` | *(empty)* | Comma-separated blocked domains |
| `WEB_BROWSING_PROXY` | *(none)* | HTTP proxy for web requests |
| `WEB_BROWSING_HEADLESS_ENABLED` | `false` | Enable headless browser (Puppeteer) |
| `PUPPETEER_EXECUTABLE_PATH` | Auto-detected | Chrome/Chromium path for headless mode |
| `WEB_BROWSING_MAX_BROWSERS` | `2` | Max concurrent browser instances |
| `WEB_BROWSING_BROWSER_IDLE_TIMEOUT` | `60000` | Browser idle timeout in ms |

#### MCP & Human-in-the-Loop

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_REQUIRE_APPROVAL` | `true` | Require user approval for MCP server management |
| `HUMAN_PROMPTS_MAX_PENDING` | `5` | Max pending human-in-the-loop prompts per Kin |

#### Sessions & Invitations

| Variable | Default | Description |
|----------|---------|-------------|
| `QUICK_SESSION_EXPIRATION_HOURS` | `24` | Quick session expiration time |
| `QUICK_SESSION_MAX_PER_USER_KIN` | `1` | Max active quick sessions per user per Kin |
| `QUICK_SESSION_RETENTION_DAYS` | `7` | Quick session data retention |
| `QUICK_SESSION_CLEANUP_INTERVAL` | `60` | Cleanup interval in minutes |
| `INVITATION_DEFAULT_EXPIRY_DAYS` | `7` | Default invitation link expiry |
| `INVITATION_MAX_ACTIVE` | `50` | Max active invitations |

#### Notifications

| Variable | Default | Description |
|----------|---------|-------------|
| `NOTIFICATIONS_RETENTION_DAYS` | `30` | Notification retention period |
| `NOTIFICATIONS_MAX_PER_USER` | `500` | Max stored notifications per user |
| `NOTIFICATIONS_EXT_MAX_PER_USER` | `5` | Max external notification endpoints per user |
| `NOTIFICATIONS_EXT_RATE_LIMIT` | `5` | External notification rate limit per minute |
| `NOTIFICATIONS_EXT_MAX_ERRORS` | `5` | Max consecutive errors before disabling endpoint |

#### Wakeups

| Variable | Default | Description |
|----------|---------|-------------|
| `WAKEUPS_MAX_PENDING_PER_KIN` | `20` | Max pending wakeups per Kin |

</details>

---

## 🔧 Troubleshooting

<details>
<summary><strong>Common issues and solutions</strong></summary>

#### Port already in use

```
Error: listen EADDRINUSE :::3000
```

Another process is using port 3000. Either stop it or change KinBot's port:

```bash
PORT=3001 bun src/server/index.ts
# or with Docker:
docker run -d -p 3001:3000 ghcr.io/marlburrow/kinbot:latest
```

#### Database migration errors after update

If you see migration errors after updating KinBot:

```bash
# Backup first
cp data/kinbot.db data/kinbot.db.bak

# Re-run migrations
bun run db:migrate
```

#### Docker container won't start

Check logs for details:

```bash
docker logs kinbot
```

Common causes:
- **Permission issues on volume:** Ensure the data directory is writable (`chmod 777 ./data` or match UID)
- **Missing encryption key:** If you previously set `ENCRYPTION_KEY`, you must provide it on every restart (vault data is encrypted with it)

#### Provider connection fails

- Verify your API key is correct and has sufficient credits
- For self-hosted providers (Ollama), ensure the base URL is reachable from the KinBot container (use `host.docker.internal` or the host's LAN IP, not `localhost`)
- Check provider status pages for outages

#### Memory search returns no results

Memory extraction runs asynchronously after each LLM turn. If you just started a conversation:
- Wait a few seconds for the extraction pipeline to complete
- Check that you have an embedding provider configured in Settings > Providers

#### Blank page / frontend not loading

```bash
# Rebuild the frontend
bun run build

# Then restart
bun src/server/index.ts
```

For Docker, pull the latest image which includes pre-built frontend assets.

</details>

---

## Contributing

Contributions are welcome! See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the full guide: setup, adding providers/channels, code style, and commit conventions.

Quick version:

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Follow existing code conventions:
   - Files: `kebab-case.ts` / Components: `PascalCase.tsx`
   - Shared types in `src/shared/types.ts`; shared constants in `src/shared/constants.ts`
   - API errors: `{ "error": { "code": "ERROR_CODE", "message": "..." } }`
   - Never hardcode user-facing text — always use `useTranslation()` and add keys to both `en.json` and `fr.json`
4. Open a Pull Request with a clear description

### Design system

The UI is built on a custom design system with 8 palettes and full dark/light mode support. Before building any new UI:
- Consult `src/client/pages/design-system/DesignSystemPage.tsx` (live showcase, source of truth)
- Use semantic CSS variables (`var(--color-*)`) or Tailwind tokens — never hardcode colors
- Reuse components from `src/client/components/ui/`

---

## License

KinBot is licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0).

You are free to use, modify, and distribute KinBot. However, if you deploy a modified version as a network service, you must also make your source code available under the same license. This protects against cloud-washing while keeping the project fully open.

For commercial use cases where the AGPL obligations are not compatible with your business, a commercial license is available — open an issue to discuss.

---

<div align="center">
Made with care · <a href="https://github.com/marlburrow">marlburrow</a>
</div>
