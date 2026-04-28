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

### Local Postgres in a container

```bash
cp .env.example .env.local       # fill in ANTHROPIC_API_KEY and R2_*
docker compose -f docker-compose.dev.yml up -d   # just Postgres
pnpm db:migrate
pnpm dev
```

App on `localhost:3000`, Postgres on `localhost:5432`.

---

## Deploying to Coolify

This repo follows the same pattern as PropGroup and Mozuk: external Postgres on your Hetzner server, app on the `coolify` network, no `ports:` exposed (Coolify's reverse proxy handles it), migrations chained into the compose `command:`.

### Steps

1. **Postgres** — already on your Hetzner server (or create a Coolify Postgres service). Just need the connection string.
2. **R2 bucket** in Cloudflare:
   - Create a bucket (e.g. `marketingen`).
   - In bucket _Settings_, enable public access (gives you a `pub-xxxxx.r2.dev` URL) **or** attach a custom domain.
   - In _Manage R2 API tokens_, create an _Object Read & Write_ token scoped to the bucket.
3. **New Application in Coolify**, point at https://github.com/AnthonyBechay/marketingen-app, build pack = Docker Compose.
4. **Environment variables** in the Coolify UI:

   | Var | Example |
   |---|---|
   | `DATABASE_URL` | `postgresql://user:pw@your-hetzner-host:5432/marketingen` |
   | `ANTHROPIC_API_KEY` | `sk-ant-...` |
   | `ANTHROPIC_MODEL` | `claude-sonnet-4-5` (optional, defaults to this) |
   | `R2_ACCOUNT_ID` | your Cloudflare account id |
   | `R2_ACCESS_KEY_ID` | from the R2 token |
   | `R2_SECRET_ACCESS_KEY` | from the R2 token |
   | `R2_BUCKET` | `marketingen` |
   | `R2_PUBLIC_URL` | `https://pub-xxxxx.r2.dev` (or your custom domain) |

5. **Domain** — point your domain at the app in Coolify's UI. The container exposes port 3000; Coolify does the rest.
6. Deploy. The compose `command:` runs `prisma migrate deploy` then starts the server. The `/api/health` endpoint backs the healthcheck.

Subsequent pushes auto-deploy.

---

## Instagram auto-publishing

Each project can be linked to one Instagram Business / Creator account
through Meta's Graph API. Once connected, scheduled posts publish
automatically and you also get a one-click "Post to IG now" button per post.

### One-time Meta app setup

1. Go to https://developers.facebook.com/apps and create a new app
   (type: **Business**).
2. Add the **Instagram Graph API** product to the app.
3. In the app's **App Roles → Roles** add yourself as a developer (and any
   other team members). While the app is in Development mode, only these
   accounts can connect.
4. Under **Use cases → Instagram → Customize**, request the scopes:
   `instagram_basic`, `instagram_content_publish`, `pages_show_list`,
   `pages_read_engagement`, `business_management`.
5. Under **Settings → Basic**, copy the **App ID** and **App Secret**.
6. Under **Facebook Login for Business → Settings → Valid OAuth Redirect URIs**,
   add `https://YOUR-DOMAIN/api/instagram/callback`.
7. The Instagram account you're connecting **must be a Business or Creator
   account** and **linked to a Facebook Page**. If yours isn't, switch
   it under Instagram → Settings → Account type.

### Env vars

| Var | Value |
|---|---|
| `META_APP_ID` | from app Settings → Basic |
| `META_APP_SECRET` | from app Settings → Basic |
| `META_REDIRECT_URI` | `https://YOUR-DOMAIN/api/instagram/callback` |
| `SESSION_SECRET` | random 32+ char string (signs OAuth state) |
| `CRON_SECRET` | random 32+ char string (auths the publish-scheduled cron) |

### Scheduling cron

The `/api/cron/publish-scheduled` endpoint scans for posts that are due
(`status="scheduled"` AND `scheduledFor <= NOW()`), publishes each via
the Graph API, and updates status. Schedule a job to hit it every minute.

**In Coolify** (recommended):

1. New Resource → **Scheduled Task**
2. Command:
   ```
   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
        https://YOUR-DOMAIN/api/cron/publish-scheduled
   ```
3. Schedule: `* * * * *` (every minute)
4. Set the same `CRON_SECRET` env var on the task.

**External cron** (alternative): cron-job.org is free and works well —
add `?secret=$CRON_SECRET` to the URL or use the Authorization header.

### What can be published

| Format | API path | Notes |
|---|---|---|
| `single` | IMAGE container | Single 1080×1350 feed post |
| `carousel` | IMAGE children + CAROUSEL container | 2–10 slides; IG hard caps at 10 |
| `case-study` | Same as carousel | Same flow with multiple slides |
| `story` | STORIES container | Single image; no stickers/links via API |

Image URLs are fetched directly from your R2 public URL by Meta's
servers, so R2 must remain publicly accessible (it already is).

### Token lifecycle

- After OAuth, we store a **long-lived (60-day) Page access token**.
- Each publish attempt opportunistically refreshes the token if it has
  less than 7 days left, so a steady cadence of posts keeps the
  connection alive forever.
- If the token expires anyway, the connection card on the project page
  shows the error and a "Reconnect" button.

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
