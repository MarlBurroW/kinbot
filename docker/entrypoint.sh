#!/bin/sh
set -e

# Fix ownership of data directory for volume mounts created as root
chown -R kinbot:kinbot /app/data 2>/dev/null || true

# Drop to non-root user and exec the command
exec gosu kinbot "$@"
