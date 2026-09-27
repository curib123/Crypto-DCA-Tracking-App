# NextFi — Crypto DCA Tracking App

NextFi is a mobile-first Progressive Web App for tracking real crypto DCA contributions, weighted average cost, break-even, fees, current value, and realized/unrealized profit or loss.

The production stack is intentionally simple:

\`\`\`
GitHub
  |
  v
Vercel
  |
  +-- Next.js 16 frontend
  +-- Next.js Route Handlers backend (/api)
  +-- server-side authentication/business logic
  |
  v
Supabase PostgreSQL
\`\`\`

## Current stack

- **Next.js 16 + React 19** — frontend and backend
- **Vercel** — production hosting, preview deployments, CI/CD target
- **Supabase PostgreSQL** — managed production database
- **Prisma** — database access and migrations
- **Google Identity Services** — Google-only customer sign-in
- **pnpm + Turborepo** — monorepo tooling
- **Chart.js** — portfolio/admin analytics
- **CoinGecko** — market prices
- **Mistral** — optional AI-assisted explanations
- **IndexedDB + service worker** — offline PWA behavior

NestJS, Docker Compose, Caddy, Oracle Cloud, and AWS EC2 are no longer required by the production architecture.

## Features preserved

- Black-and-white SaaS landing page
- Installable mobile-first PWA
- Google-only customer login
- HttpOnly signed application session
- Separate secure control-panel login
- Admin dashboard, user controls, landing CMS, AdSense policy, and audit log
- Crypto transaction ledger
- BUY / SELL / TRANSFER / REWARD / AIRDROP / FEE / ADJUSTMENT support
- Weighted average cost and break-even
- Realized/unrealized P/L
- Multi-currency ledger with FX-to-base values
- CoinGecko market snapshots with graceful fallback
- Offline cached portfolio and queued transactions
- Optional Mistral analytics explanations
- SEO metadata, sitemap, robots, JSON-LD, and PWA manifest

## Repository structure

\`\`\`
apps/
  web/
    app/
      api/[...path]/route.ts   # Full Next.js backend
      app/                     # Signed-in PWA
      admin/                   # Control panel
    lib/
      server/                  # Database, auth, services
    prisma/
      migrations/
      schema.prisma
      seed.ts
    components/
    public/
    styles/

packages/
  core/                        # Pure cost-basis and ledger calculation engine

docs/
  VERCEL_SUPABASE_DEPLOYMENT.md
  SCALING.md
\`\`\`

## Why the backend is inside Next.js

NextFi's API surface is request/response oriented and fits Route Handlers well. Keeping the frontend and backend in one Next.js application gives:

- one Vercel deployment
- same-origin \`/api\` calls
- no CORS configuration
- no second server to operate
- no Docker/VPS patching
- shared TypeScript code
- simpler preview environments

The financial calculation engine remains isolated in \`packages/core\`; Route Handlers orchestrate HTTP/auth and call server services rather than owning cost-basis rules.

## Local setup

Requirements:

- Node.js 22+
- pnpm 10+
- a Supabase PostgreSQL project, or another PostgreSQL database for local development

\`\`\`bash
corepack enable
pnpm install
cp .env.example .env
\`\`\`

Fill in the required environment variables.

Generate Prisma and apply committed migrations:

\`\`\`bash
pnpm db:generate
pnpm db:deploy
\`\`\`

Run the app:

\`\`\`bash
pnpm dev
\`\`\`

Open:

- App: http://localhost:3000
- API health: http://localhost:3000/api/health
- Control panel: http://localhost:3000/admin

## Supabase connections

Use two PostgreSQL URLs:

\`\`\`text
DATABASE_URL = transaction pooler / serverless runtime
DIRECT_URL   = session pooler or direct connection / Prisma migrations
\`\`\`

The browser never receives either database URL. Prisma runs only on the server.

## API

The browser uses the same origin:

\`\`\`text
/api/auth/*
/api/transactions
/api/portfolio/summary
/api/market/prices
/api/settings
/api/ai/insights
/api/content/landing
/api/ads/*
/api/admin-auth/*
/api/admin/*
\`\`\`

\`NEXT_PUBLIC_API_URL\` should normally remain \`/api\`.

## Tests

\`\`\`bash
pnpm --filter @crypto-dca/core test
pnpm --filter @crypto-dca/web test
pnpm --filter @crypto-dca/web typecheck
pnpm --filter @crypto-dca/web build
\`\`\`

GitHub Actions also validates Prisma migrations against PostgreSQL.

## Production deployment

See [docs/VERCEL_SUPABASE_DEPLOYMENT.md](docs/VERCEL_SUPABASE_DEPLOYMENT.md).

For Vercel, configure:

- Root Directory: \`apps/web\`
- Framework: Next.js
- Build Command: \`cd ../.. && pnpm --filter @crypto-dca/web build\`
- Output Directory: \`.next\`

Then add the environment variables from \`.env.example\`.

## Security notes

- Never commit \`.env\`, Supabase passwords, OAuth credentials, or session secrets.
- Customer sessions and control-panel sessions use separate HttpOnly cookies.
- Production requires long independent session secrets.
- The control panel forces a bootstrap-password change and applies lockout after repeated failed logins.
- All user-specific database queries are scoped by the authenticated application user.
- NextFi does not custody crypto and never requests wallet seed phrases or private keys.

## Scaling

See [docs/SCALING.md](docs/SCALING.md).

The durable source of truth is PostgreSQL. Serverless process memory is treated only as an optimization, so Vercel instances can be replaced without affecting ledger correctness.
