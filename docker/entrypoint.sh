#!/bin/sh
set -e

# Fix ownership of data directory for volume mounts created as root
chown -R kinbot:kinbot /app/data 2>/dev/null || true

# Ensure KINBOT_VERSION is set from package.json if not already provided
if [ -z "$KINBOT_VERSION" ] && [ -f /app/package.json ]; then
  KINBOT_VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' /app/package.json | head -1 | sed 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
  export KINBOT_VERSION
fi

# Drop to non-root user and exec the command
exec gosu kinbot "$@"
