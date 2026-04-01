# 1. Use the official Bun image
FROM oven/bun:1

# 2. Install build dependencies (needed for better-sqlite3)
# We use apt-get because oven/bun is based on Debian
USER root
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 3. Copy package files
COPY package.json pnpm-lock.yaml* ./

# 4. Install dependencies
# Bun will now be able to compile better-sqlite3 using the tools above
RUN bun install

# 5. Copy the rest of the source
COPY . .

# 6. Build The Frontend
RUN bun run build

# 7. Ensure the data directory exists
RUN mkdir -p /app/data

EXPOSE 3000


CMD ["bun", "src/server/index.ts"]
