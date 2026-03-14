---
title: Configuration
description: Environment variables and settings for KinBot.
---

KinBot uses environment variables for configuration. Copy `.env.example` to `.env` and adjust as needed. All values have sensible defaults — you can start with an empty `.env`.

## Core settings

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3333` (`3000` in Docker) | HTTP server port |
| `HOST` | `127.0.0.1` | Bind address (`0.0.0.0` to expose on all interfaces) |
| `KINBOT_DATA_DIR` | `./data` | Persistent data directory (DB, uploads, workspaces) |
| `DB_PATH` | `$KINBOT_DATA_DIR/kinbot.db` | SQLite database file path |
| `ENCRYPTION_KEY` | *(auto-generated)* | 64-char hex key for AES-256-GCM vault encryption. Auto-generated and persisted to `data/.encryption-key` on first run. |
| `BETTER_AUTH_SECRET` | *(uses ENCRYPTION_KEY)* | Secret for session signing. Falls back to `ENCRYPTION_KEY` if not set. |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |
| `PUBLIC_URL` | `http://localhost:<PORT>` | Public-facing URL (used in webhooks, invitation links) |

## Data directory

KinBot stores everything in a single directory (`KINBOT_DATA_DIR`):

- **SQLite database** — messages, kins, settings, memories
- **File uploads** — user-uploaded files and generated images
- **Kin workspaces** — custom tools and scripts created by Kins
- **Encryption key** — auto-generated on first run if not provided

:::tip
When using Docker, mount a volume to `/app/data` to persist data across container restarts.
:::

## History

| Variable | Default | Description |
|---|---|---|
| `HISTORY_TOKEN_BUDGET` | `40000` | Max tokens for conversation history in context |

## Webhooks

| Variable | Default | Description |
|---|---|---|
| `WEBHOOKS_LOG_RETENTION_DAYS` | `30` | Webhook execution log retention period in days |
| `WEBHOOKS_MAX_LOGS_PER_WEBHOOK` | `500` | Max stored execution logs per webhook |
| `WEBHOOKS_RATE_LIMIT_PER_MINUTE` | `60` | Max webhook executions per minute |

## Uploads

| Variable | Default | Description |
|---|---|---|
| `UPLOAD_CHANNEL_RETENTION_DAYS` | `30` | Channel file retention period in days |
| `UPLOAD_CHANNEL_CLEANUP_INTERVAL` | `60` | Channel file cleanup interval in minutes |

## Version checking

| Variable | Default | Description |
|---|---|---|
| `VERSION_CHECK_ENABLED` | `false` | Enable automatic version checking against GitHub releases |
| `VERSION_CHECK_REPO` | `MarlBurroW/kinbot` | GitHub repo to check for new releases |
| `VERSION_CHECK_INTERVAL_HOURS` | `12` | Hours between version checks |

## Advanced options

See [`.env.example`](https://github.com/MarlBurroW/kinbot/blob/main/.env.example) for the complete list of all options including:

- Compacting threshold (`COMPACTING_THRESHOLD_PERCENT`, default 75%)
- Memory tuning (extraction, vector dimensions, search pipeline)
- Tool step limit (`TOOLS_MAX_STEPS`, default 0 = unlimited)
- Queue settings
- Cron limits
- Web browsing configuration
