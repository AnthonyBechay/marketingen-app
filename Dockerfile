# Multi-stage Dockerfile for Marketingen — Next.js + Playwright + Prisma.
# Coolify-friendly: single image, standalone Next.js output.

# ─── Stage 1: Build ─────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Enable Corepack to use pnpm consistently with the lockfile.
RUN corepack enable

# Install just enough build deps for native modules (bcrypt etc).
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates python3 build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

COPY . .

# Generate Prisma client
RUN pnpm prisma generate

# Build the Next.js standalone output
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# Prune dev deps so we ship a smaller node_modules
RUN pnpm prune --prod

# ─── Stage 2: Runtime ───────────────────────────────────────────
# We use the official Playwright image to get Chromium + system deps preinstalled.
FROM mcr.microsoft.com/playwright:v1.59.1-jammy AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Copy standalone build output + assets + Prisma engine + node_modules.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Tiny entrypoint: run migrations on boot, then start the server.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
