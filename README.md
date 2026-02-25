<div align="center">

# KinBot

**A self-hosted platform of specialized AI agents with persistent identity, continuous memory, and real collaboration.**

[![GitHub Release](https://img.shields.io/github/v/release/MarlBurroW/kinbot?style=flat-square&color=a855f7)](https://github.com/MarlBurroW/kinbot/releases)
[![GitHub Stars](https://img.shields.io/github/stars/MarlBurroW/kinbot?style=flat-square&color=ec4899)](https://github.com/MarlBurroW/kinbot)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg?style=flat-square)](LICENSE)
[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun-f9f1e1?style=flat-square&logo=bun&logoColor=black)](https://bun.sh)
[![Stack: React + Hono](https://img.shields.io/badge/Stack-React%20%2B%20Hono-61dafb?style=flat-square&logo=react&logoColor=black)](https://hono.dev)

[Features](#features) · [Quick Start](#quick-start) · [Architecture](#architecture) · [Configuration](#configuration) · [Development](#development) · [Contributing](#contributing)

</div>

---

## What is KinBot?

Most AI assistants are **stateless** — each conversation starts from zero, they don't know who you are, they forget everything, and they can't work autonomously. KinBot is different.

KinBot lets you create **Kins** — specialized AI agents that have:

- **Persistent identity** — a name, role, character, expertise, and avatar. They know who they are and who they're talking to.
- **One continuous session** — never "new conversation". Kins remember every interaction from day one.
- **Long-term memory** — automatically extract and recall important facts across months of conversations.
- **Autonomy** — delegate work to sub-Kins, run scheduled jobs, react to webhooks and messages from external platforms.
- **Collaboration** — Kins communicate with each other, share context, spawn workers for complex tasks.

It's a **self-hosted** platform designed for individuals and small groups (family, friends, small teams). One process, one SQLite file, one server — zero external infrastructure required.

---

## Features

### Kins
- **Persistent identity** — each Kin has a name, description, character, expertise domain, model, and avatar
- **Continuous sessions** — one session per Kin, never resets
- **Shared Kins** — all users on the instance interact with the same Kins; messages are tagged with sender identity

### Intelligence
- **Long-term memory** — dual-channel: automatic extraction pipeline on every LLM turn + explicit `remember()` tool; hybrid search (vector similarity + full-text)
- **Session compacting** — automatic summarization to stay within token limits; original messages are always preserved, snapshots are rollback-able
- **Sub-Kins (tasks)** — Kins can delegate work to ephemeral sub-agents; `await` mode re-enters the parent queue with the result, `async` mode deposits it as informational
- **Inter-Kin communication** — request/reply pattern with correlation IDs; rate-limited; replies are always informational (no ping-pong)

### Automation
- **Cron jobs** — in-process scheduler (croner); Kins can create their own crons (with user approval); cron results appear in the main session
- **Webhooks** — inbound webhooks to trigger Kins from external systems; configurable per-Kin
- **Channels** — Telegram integration; receive and send messages through external platforms

### Security & Privacy
- **Vault** — AES-256-GCM encrypted secrets; never exposed in prompts or logs; message redaction prevents leaking into compacted summaries
- **Authentication** — Better Auth with HTTP-only cookie sessions; admin + member roles; invitation system
- **Self-hosted** — your data never leaves your server

### Extensibility
- **MCP servers** — connect any Model Context Protocol server to extend Kins with external tools
- **Custom tools** — Kins can create, register, and run their own scripts from their workspace
- **Multi-provider** — 15 providers: Anthropic, OpenAI, Gemini, Mistral, DeepSeek, Groq, Together AI, Fireworks AI, Ollama, OpenRouter, Cohere, xAI, Voyage AI, Brave Search, and more; configure once, capabilities auto-detected

### Experience
- **8 color palettes** — Aurora, Ocean, Forest, Sunset, Monochrome, Sakura, Neon, Lavender
- **Dark / Light / System** theme modes
- **Internationalization** — English and French
- **File uploads** — share files with Kins; image generation supported
- **Real-time streaming** — SSE-based, multiplexed across all Kins on a single connection

---

## Quick Start

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

Open `http://localhost:3000` — the onboarding wizard will guide you through the rest (create your admin account + configure AI providers).

**Customizable via env vars before running:**
```bash
KINBOT_DIR=/home/me/kinbot \
KINBOT_DATA_DIR=/home/me/kinbot-data \
KINBOT_PORT=8080 \
  bash <(curl -fsSL https://raw.githubusercontent.com/MarlBurroW/kinbot/main/install.sh)
```

### Docker

```bash
docker run -d \
  --name kinbot \
  -p 3000:3000 \
  -v kinbot-data:/app/data \
  --restart unless-stopped \
  ghcr.io/MarlBurroW/kinbot:latest
```

Or with Docker Compose (see [`docker/docker-compose.yml`](docker/docker-compose.yml)):
```bash
git clone https://github.com/MarlBurroW/kinbot.git
cd kinbot/docker
ENCRYPTION_KEY=$(openssl rand -hex 32) docker compose up -d
```

### Manual

```bash
git clone https://github.com/MarlBurroW/kinbot.git
cd kinbot
bun install
bun run build
bun run db:migrate
NODE_ENV=production bun run start
```

---

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                   KinBot  (single process)                    │
│                                                               │
│  ┌──────────────────┐      ┌───────────────────────────────┐  │
│  │  React + Vite    │      │        Hono REST API          │  │
│  │  Tailwind 4      │◀───▶│        + SSE stream           │  │
│  │  shadcn/ui       │      └──────────────┬────────────────┘  │
│  └──────────────────┘                     │                   │
│                                           │                   │
│              ┌────────────────────────────┤                   │
│              │            │               │                   │
│    ┌─────────▼──┐  ┌──────▼────┐  ┌──────▼──────┐             │
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
| **AI Providers** | Anthropic, OpenAI, Gemini, Mistral, DeepSeek, Groq, Together AI, Fireworks AI, Ollama, OpenRouter, Cohere, xAI, Voyage AI, Brave Search |
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

Contributions are welcome. Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
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
