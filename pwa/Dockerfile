# Zault Chat PWA - Production Dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Build the app
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build
RUN bun run build

# Production image
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000

# Copy built output
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./

# Don't run as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 zault
USER zault

EXPOSE 3000

CMD ["bun", "run", ".output/server/index.mjs"]

