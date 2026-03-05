---
title: Installation
description: Get KinBot running in under a minute.
---

KinBot runs as a single process with an embedded SQLite database. No Postgres, no Redis, no external dependencies.

## Docker (recommended)

```bash
docker run -d --name kinbot \
  -p 3000:3000 \
  -v kinbot-data:/app/data \
  ghcr.io/marlburrow/kinbot:latest
```

Open `http://localhost:3000` — the onboarding wizard handles the rest.

## One-liner script (Linux / macOS)

```bash
curl -fsSL https://raw.githubusercontent.com/MarlBurroW/kinbot/main/install.sh | bash
```

This will:
1. Install [Bun](https://bun.sh) if not present
2. Clone the repository to `/opt/kinbot`
3. Install dependencies and build the frontend
4. Run database migrations
5. Create a system service (systemd on Linux, launchd on macOS)
6. Start KinBot on port **3000**

### Customizing the install

```bash
KINBOT_DIR=/home/me/kinbot \
KINBOT_DATA_DIR=/home/me/kinbot-data \
KINBOT_PORT=8080 \
  bash <(curl -fsSL https://raw.githubusercontent.com/MarlBurroW/kinbot/main/install.sh)
```

## Docker Compose

```bash
git clone https://github.com/MarlBurroW/kinbot.git
cd kinbot/docker
ENCRYPTION_KEY=$(openssl rand -hex 32) docker compose up -d
```

See [`docker/docker-compose.yml`](https://github.com/MarlBurroW/kinbot/blob/main/docker/docker-compose.yml) for all options.

## Manual install

```bash
git clone https://github.com/MarlBurroW/kinbot.git
cd kinbot
bun install
bun run build
bun run db:migrate
NODE_ENV=production bun run start
```

### Prerequisites

- [Bun](https://bun.sh) >= 1.0
- Git

## What's next?

Head to [First Kin](/kinbot/docs/getting-started/first-kin/) to create your first AI agent.
