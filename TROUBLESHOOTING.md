# Troubleshooting

Common issues and solutions when running KinBot.

## Installation

### `better-sqlite3` build fails (node-gyp errors)

KinBot uses `better-sqlite3` which requires native compilation. If the install fails with `node-gyp` errors:

**Linux (Debian/Ubuntu):**
```bash
sudo apt-get install python3 make g++
```

**Linux (Fedora/RHEL):**
```bash
sudo dnf install python3 make gcc-c++
```

**macOS:**
```bash
xcode-select --install
```

Then retry `bun install`.

### `bun install` hangs or fails on lockfile

If you see errors about `bun.lock`:

```bash
rm -rf node_modules bun.lock
bun install
```

### Permission denied during install

Don't run the installer with `sudo`. If you previously did:

```bash
sudo chown -R $(whoami) /path/to/kinbot
bun install
```

## Startup

### Port already in use (`EADDRINUSE`)

Another process is using the port (default 3333):

```bash
# Find what's using the port
lsof -i :3333

# Use a different port
PORT=4000 bun run start
```

### Database migration errors

If KinBot fails to start with database errors after an update:

```bash
bun run db:migrate
```

If that fails, the database may be corrupted. Check if you have a backup in your data directory. As a last resort:

```bash
# Back up first!
cp data/kinbot.db data/kinbot.db.bak
# Then try migrating again
bun run db:migrate
```

### `ENCRYPTION_KEY` warnings

KinBot auto-generates an encryption key on first run and stores it in the database. If you see warnings about the encryption key:

- **Don't change it** after initial setup, or vault entries become unreadable
- If migrating to a new server, copy the entire `data/` directory
- To explicitly set it: `ENCRYPTION_KEY=$(openssl rand -hex 32)` before first start

## Memory & Vector Search

### "sqlite-vec extension not available"

Vector search (semantic memory) requires the `sqlite-vec` extension. If you see this warning:

- KinBot still works, but memory recall falls back to full-text search only
- The extension is bundled automatically on most platforms
- On Alpine Linux or unusual architectures, it may not be available

### Memory not being recalled

If your Kin seems to forget things:

1. Check that an **embedding provider** is configured (e.g., OpenAI with `text-embedding-3-small`)
2. Verify the provider has the `embedding` capability in Settings > Providers
3. Check `MEMORY_SIMILARITY_THRESHOLD` (default `0.7`) — lower it if memories aren't matching
4. Check `MEMORY_MAX_RELEVANT` (default `10`) — increase for more context

## Channels

### Telegram webhook not receiving messages

1. Ensure `PUBLIC_URL` is set to your externally-accessible URL (with HTTPS)
2. The URL must be reachable from Telegram's servers
3. Check logs for "Error handling Telegram update" messages
4. Verify the bot token in channel settings

### Discord bot not responding

1. Check that the bot has the required intents enabled in the [Discord Developer Portal](https://discord.com/developers/applications):
   - **Message Content Intent** (required for reading messages)
   - **Server Members Intent** (if using member features)
2. Verify the bot token in channel settings
3. Check logs for WebSocket connection errors

### WhatsApp webhook verification failing

1. Ensure the **Verify Token** matches between Meta's webhook config and KinBot's channel settings
2. `PUBLIC_URL` must be HTTPS and reachable from Meta's servers
3. Check logs for "Webhook verification token mismatch"

### Signal messages not arriving

1. Verify `signal-cli` REST API is running and accessible
2. Check the API URL in channel settings (default: `http://localhost:8080`)
3. Ensure the phone number is registered with Signal

## Docker

### Container starts but can't access the UI

```bash
# Verify the container is running
docker ps | grep kinbot

# Check logs
docker logs kinbot

# Ensure you're mapping the port correctly
docker run -p 3000:3000 ...
```

### Data persistence across container restarts

Always mount a volume for the data directory:

```bash
docker run -v kinbot-data:/app/data ...
```

Without this, all data (database, uploads, workspaces) is lost when the container is removed.

### Docker build fails on ARM (Raspberry Pi)

The multi-arch image supports `linux/amd64` and `linux/arm64`. For Raspberry Pi:

```bash
# Pull the arm64 image
docker pull ghcr.io/marlburrow/kinbot:latest

# Or build locally
docker build -f docker/Dockerfile .
```

## Performance

### High memory usage

- **Session compacting** reduces context size — check `COMPACTING_THRESHOLD_PERCENT` and `COMPACTING_KEEP_PERCENT`
- Reduce `MEMORY_MAX_RELEVANT` if too many memories are injected per turn
- Lower `WEB_BROWSING_MAX_CONCURRENT` and `WEB_BROWSING_MAX_BROWSERS` if web browsing is active

### Slow responses

1. Check your LLM provider's status page
2. If using Ollama locally, ensure your hardware can handle the model size
3. Reduce `TOOLS_MAX_STEPS` if the agent is making too many tool calls
4. Check `QUEUE_POLL_INTERVAL` — the default (500ms) is fine for most setups

## Logs

Enable debug logging for more detail:

```bash
LOG_LEVEL=debug bun run start
```

For Docker:

```bash
docker run -e LOG_LEVEL=debug ...
```

## Diagnostic Report

The installer includes a `--doctor` command that generates a comprehensive diagnostic report covering your system, KinBot installation, runtime, providers, and database health:

```bash
bash install.sh --doctor
```

This outputs a Markdown report you can paste directly into a GitHub issue. To save it to a file:

```bash
bash install.sh --doctor > report.md
```

The report includes:
- System info (OS, kernel, memory, disk, container detection)
- Bun and Git versions
- KinBot installation status, version, and configuration
- Service health (systemd/launchd/Docker)
- Database integrity and stats
- Provider configuration summary
- Recent log entries

## Viewing Logs

The installer also provides a cross-platform way to tail KinBot logs:

```bash
bash install.sh --logs
```

This works whether KinBot is running via systemd, launchd, or Docker.

## Still stuck?

- Run `bash install.sh --doctor` and include the output
- Check [existing issues](https://github.com/MarlBurroW/kinbot/issues) for similar problems
- Open a [new issue](https://github.com/MarlBurroW/kinbot/issues/new/choose) with:
  - Diagnostic report (`bash install.sh --doctor`)
  - Steps to reproduce
  - Any additional log output
