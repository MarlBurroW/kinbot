# ─── Stage 1: Install dependencies ────────────────────────────────────────────
FROM oven/bun:1 AS deps
WORKDIR /app

# better-sqlite3 needs native build tools for node-gyp
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ─── Stage 2: Build frontend ─────────────────────────────────────────────────
FROM deps AS build
WORKDIR /app

COPY . .
RUN bun run build

# ─── Stage 3: Production image ───────────────────────────────────────────────
FROM oven/bun:1 AS production
WORKDIR /app

LABEL org.opencontainers.image.title="KinBot" \
      org.opencontainers.image.description="Self-hosted AI agents with persistent memory, real identity, and collaboration" \
      org.opencontainers.image.url="https://github.com/MarlBurroW/kinbot" \
      org.opencontainers.image.source="https://github.com/MarlBurroW/kinbot" \
      org.opencontainers.image.licenses="AGPL-3.0"

# Install production dependencies (better-sqlite3 needs build tools for node-gyp)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json bun.lock ./
# Remove husky prepare script (not needed in production, bun ignores HUSKY=0)
RUN sed -i '/"prepare":/d' package.json && \
    bun install --frozen-lockfile --production && \
    apt-get purge -y python3 make g++ && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

# Install gosu for entrypoint privilege dropping
RUN apt-get update && apt-get install -y --no-install-recommends gosu && rm -rf /var/lib/apt/lists/*

# Copy built frontend
COPY --from=build /app/dist ./dist

# Copy server source + shared types + config files
COPY --from=build /app/src/server ./src/server
COPY --from=build /app/src/shared ./src/shared
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build /app/registry ./registry
COPY --from=build /app/store ./store

# Create non-root user for security
RUN groupadd --gid 1001 kinbot && \
    useradd --uid 1001 --gid kinbot --shell /bin/sh --create-home kinbot

# Create data directory with correct ownership
RUN mkdir -p /app/data && chown -R kinbot:kinbot /app/data

# Environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV KINBOT_DATA_DIR=/app/data

EXPOSE 3000

VOLUME ["/app/data"]

# Copy entrypoint script (handles permission fixing + privilege dropping)
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["bun", "src/server/index.ts"]
