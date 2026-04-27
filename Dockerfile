# Multi-stage Dockerfile for Marketingen — Next.js + Playwright + Prisma.
# Single image, standalone Next.js output, Coolify-friendly.

# ─── Stage 1: Build ─────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app

RUN corepack enable

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates python3 build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

COPY . .

RUN pnpm prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

RUN pnpm prune --prod

# ─── Stage 2: Runtime ───────────────────────────────────────────
# Microsoft Playwright runtime — Chromium + system deps preinstalled.
FROM mcr.microsoft.com/playwright:v1.59.1-jammy AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Standalone output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Prisma — schema + migrations + generated client + the prisma CLI binary
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

EXPOSE 3000

# Default command runs migrations then starts the server. Override-able from
# docker-compose.yml. Equivalent to:
#   npx prisma migrate deploy && node server.js
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
