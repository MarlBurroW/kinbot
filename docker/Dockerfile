FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production=false

# Build frontend
FROM deps AS build
COPY . .
RUN bun run build

# Production
FROM base AS production
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/server ./src/server
COPY --from=build /app/src/shared ./src/shared
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV KINBOT_DATA_DIR=/app/data

EXPOSE 3000

VOLUME ["/app/data"]

CMD ["bun", "src/server/index.ts"]
