# marketingen — multi-tenant Instagram post generator

A self-hostable SaaS that turns ideas into branded Instagram carousels and stories. Each user manages multiple projects (one per brand). Each project has its own brand identity, campaign queue, and post history. Claude generates the post content; Playwright renders the slides; Cloudflare R2 stores the images.

**Stack:** Next.js 16 App Router · TypeScript · Tailwind CSS v4 · Prisma + PostgreSQL · Anthropic SDK · Playwright · Cloudflare R2 (S3-compatible) · Coolify-friendly Docker.

---

## Features

- **Multi-tenant auth** — register / login / logout with bcrypt + httpOnly session cookies.
- **Per-user projects** — one workspace per brand. Switch between them freely.
- **Brand editor** — colors (color pickers), logo SVG, fonts, voice, audience, pricing anchors, hashtag pool, default CTA. The renderer reads all of this so every generated slide matches.
- **Campaign editor** — define content pillars, tone rules, idea queue. Or click _"Help me build a campaign"_ and Claude drafts pillars + an 8-12 idea queue from a brief.
- **AI post generation** — pull from queue or describe a fresh idea. The system prompt embeds your brand voice and the last 8 published posts so Claude doesn't repeat angles.
- **7 slide types** — cover, numbered, comparison, cta, terminal, case_study, feature_grid. Plus 21 Lucide-style icons.
- **R2 image storage** — every slide PNG uploads to your bucket. Public URLs in the post detail view.
- **Post management** — mark posted (auto-stamps `postedAt`), mark draft, archive, delete (also cleans up R2).
- **Copy caption** — one click to clipboard; paste straight into Instagram.

---

## Local development

### Prerequisites

- Node 22+ and pnpm
- Postgres (any 14+; v16 in the compose file)
- An Anthropic API key
- A Cloudflare R2 bucket with public access enabled, plus an API token

### Setup

```bash
git clone https://github.com/AnthonyBechay/marketingen-app.git
cd marketingen-app
pnpm install

cp .env.example .env.local
# fill in DATABASE_URL, ANTHROPIC_API_KEY, R2_*

pnpm db:migrate                  # create tables
pnpm dev                         # http://localhost:3000
```

For Playwright to render slides locally, install Chromium once:

```bash
pnpm exec playwright install chromium
```

### With Docker (full stack: app + Postgres)

```bash
cp .env.example .env             # docker-compose reads root .env
docker compose up --build
```

The app runs on `http://localhost:3000`; Postgres is exposed on `5432`. Migrations run automatically via the entrypoint.

---

## Deploying to Coolify

This repo is built to run as a single Docker image. The Dockerfile:

- Builds Next.js with `output: "standalone"` for a tiny runtime.
- Uses the official `mcr.microsoft.com/playwright` runtime image so Chromium is preinstalled — no flaky `playwright install` at boot.
- Runs `prisma migrate deploy` automatically on container start.

### Steps

1. **Postgres** — create a Postgres service in Coolify (or bring your own). Note the connection string.
2. **R2 bucket** — in Cloudflare:
   - Create a bucket (e.g. `marketingen`).
   - In _Settings_, enable public access (gives you a `pub-xxxxx.r2.dev` URL) **or** attach a custom domain.
   - In _Manage R2 API tokens_, create an _Object Read & Write_ token scoped to the bucket. Save the access key + secret + your account ID.
3. **New Application in Coolify**, point at this GitHub repo, select Dockerfile build.
4. **Environment variables** (set in Coolify UI):

   | Var | Example |
   |---|---|
   | `DATABASE_URL` | `postgresql://user:pw@postgres:5432/marketingen` |
   | `ANTHROPIC_API_KEY` | `sk-ant-...` |
   | `ANTHROPIC_MODEL` | `claude-sonnet-4-5` |
   | `R2_ACCOUNT_ID` | your Cloudflare account id |
   | `R2_ACCESS_KEY_ID` | from the R2 token |
   | `R2_SECRET_ACCESS_KEY` | from the R2 token |
   | `R2_BUCKET` | `marketingen` |
   | `R2_PUBLIC_URL` | `https://pub-xxxxx.r2.dev` (or your custom domain) |

5. **Port** — `3000`.
6. Deploy. The first boot runs migrations; the `/register` page is live.

That's it. Subsequent pushes auto-deploy.

---

## How the AI generation works (short version)

For each post, the system prompt sent to Claude includes:

1. **Brand voice + audience + pricing anchors** from `Brand`.
2. **Active content pillars + tone rules** from `Campaign`.
3. **Last 8 published post summaries** (memory) so it picks an angle that hasn't been used.
4. **The 7 slide-type schemas** + the icon library + brand-specific defaults.

Claude returns a JSON post (`{name, caption, slides: [...]}`). The dispatcher in `lib/slides.ts` turns each slide spec into HTML, Playwright renders to PNG, and `lib/r2.ts` uploads. The post + slide URLs are persisted in `Post`.

When pulled from the queue (`generateFromQueueAction`), the queue item is removed in the same transaction as the post creation — so a successful generate decrements the queue, a failure leaves it intact.

---

## Database schema (overview)

- `User` ← `Session` (cookie-backed sessions, no NextAuth)
- `User` → `Project[]`
  - `Project` 1:1 `Brand` (colors, logo, voice, fonts, anchors, hashtags)
  - `Project` 1:1 `Campaign` (goal, pillars, tone rules)
  - `Project` → `QueueItem[]` (ordered idea queue)
  - `Project` → `Post[]` (generated posts: caption, slidesJson, imageUrls, status)

Cascade deletes wired everywhere — deleting a project nukes its brand, campaign, queue, and posts.

---

## Roadmap (good first PRs)

- Drag-to-reorder for the queue UI
- Edit a post's slides JSON in-app and re-render
- Cron-mode for auto-generating from queue on a schedule
- Per-user usage tracking and rate limiting
- Stripe billing for paid tiers

---

Built by [Anthony Bechay](https://bechai.ai). MIT.
