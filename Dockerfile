# Multi-stage Dockerfile for Marketingen — Next.js + Playwright + Prisma.
# Single image, standalone Next.js output, Coolify-friendly.

# ─── Stage 1: Build ─────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app

RUN corepack enable

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates python3 build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy manifests, the Prisma schema, AND .npmrc before install:
# - .npmrc declares `node-linker=hoisted` so node_modules is flat (npm-style)
#   instead of pnpm's default symlink-into-`.pnpm/` layout. Without this,
#   the multi-stage `COPY --from=builder /app/node_modules/.prisma` later
#   resolves to a missing path (everything lives under .pnpm/).
# - The `postinstall` hook runs `prisma generate` and needs the schema.
COPY package.json pnpm-lock.yaml .npmrc ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile --prod=false

# Now copy the rest of the source.
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# Note: we deliberately do NOT run `pnpm prune --prod` because we need the
# `prisma` CLI (a devDependency) at runtime for `migrate deploy`. The
# standalone Next.js output already bundles only prod deps so the
# runtime image stays slim.

# ─── Stage 2: Runtime ───────────────────────────────────────────
# Microsoft Playwright runtime — Chromium + system deps preinstalled.
FROM mcr.microsoft.com/playwright:v1.59.1-jammy AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Standalone Next.js output (server.js + a minimal traced node_modules).
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Prisma schema + migrations.
COPY --from=builder /app/prisma ./prisma

# Override the slim standalone node_modules with the full hoisted one
# from the builder. We tried cherry-picking @prisma/, .prisma/, prisma/
# but the prisma CLI needs additional transitive deps (effect, …) that
# don't live in those folders. Copying the whole tree is the simplest
# robust fix; Playwright's base image is already ~1.5 GB so the extra
# weight is rounding error.
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

# Migrate then start. Calling the prisma CLI by file path avoids the
# .bin symlink dereferencing issue described above.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]
