---
title: Configuration
description: Environment variables and settings for KinBot.
---

KinBot uses environment variables for configuration. Copy `.env.example` to `.env` and adjust as needed. All values have sensible defaults — you can start with an empty `.env`.

## Core settings

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3333` | HTTP server port |
| `HOST` | `127.0.0.1` | Bind address (`0.0.0.0` to expose on all interfaces) |
| `KINBOT_DATA_DIR` | `./data` | Persistent data directory (DB, uploads, workspaces) |
| `ENCRYPTION_KEY` | *(auto-generated)* | 64-char hex key for AES-256-GCM vault encryption. Auto-generated and persisted to `data/.encryption-key` on first run. |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |
| `PUBLIC_URL` | `http://localhost:3333` | Public-facing URL (used in webhooks, invitation links) |

## Data directory

KinBot stores everything in a single directory (`KINBOT_DATA_DIR`):

- **SQLite database** — messages, kins, settings, memories
- **File uploads** — user-uploaded files and generated images
- **Kin workspaces** — custom tools and scripts created by Kins
- **Encryption key** — auto-generated on first run if not provided

:::tip
When using Docker, mount a volume to `/app/data` to persist data across container restarts.
:::

## Advanced options

See [`.env.example`](https://github.com/MarlBurroW/kinbot/blob/main/.env.example) for the complete list of all options including:

- Compacting thresholds
- Memory tuning (extraction, vector dimensions)
- Queue settings
- Cron limits
- Web browsing configuration
