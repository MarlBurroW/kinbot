<div align="center">

# KinBot

**AI agents that actually remember you.**

Self-hosted. Persistent memory. Real collaboration.

[![CI](https://github.com/MarlBurroW/kinbot/actions/workflows/ci.yml/badge.svg)](https://github.com/MarlBurroW/kinbot/actions/workflows/ci.yml)
[![GitHub Release](https://img.shields.io/github/v/release/MarlBurroW/kinbot?style=flat-square&color=a855f7)](https://github.com/MarlBurroW/kinbot/releases)
[![GitHub Stars](https://img.shields.io/github/stars/MarlBurroW/kinbot?style=flat-square&color=ec4899)](https://github.com/MarlBurroW/kinbot)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg?style=flat-square)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://github.com/MarlBurroW/kinbot/pkgs/container/kinbot)

[Website](https://marlburrow.github.io/kinbot/) · [Quick Start](#-quick-start) · [Features](#-features) · [Architecture](#-architecture) · [Changelog](CHANGELOG.md) · [Contributing](#contributing)

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

## ✨ Features

### 🧠 Intelligence
Persistent memory (vector + full-text) · Session compacting · Sub-agents · Inter-Kin communication · Continuous sessions that never reset

### 🔧 Automation & Extensibility
Cron jobs · Webhooks · 6 channels (Telegram, Discord, Slack, WhatsApp, Signal, Matrix) · MCP servers · Custom tools · Contacts · Notifications · Human-in-the-loop prompts · 23 AI providers (incl. Ollama) · Multi-provider auto-detection

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
