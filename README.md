# NextFi — Crypto DCA Tracking App

NextFi is a mobile-first Progressive Web App for tracking real crypto DCA contributions, weighted average cost, break-even, fees, current value, and realized/unrealized profit or loss.

## Production architecture

```text
GitHub
  |
  v
Vercel Free
  |
  v
Next.js 16
├── Frontend / PWA
├── Route Handlers (/api)
├── server-side auth
└── business logic
  |
  v
Supabase Free
└── PostgreSQL
```

There is no separate NestJS API, Docker host, Oracle VM, AWS EC2 instance, Caddy proxy, or second production server.

## Current stack

- **Next.js 16 + React 19** — frontend and backend
- **Vercel** — hosting and GitHub-based deployments
- **Supabase PostgreSQL** — managed database
- **Supabase CLI** — authoritative SQL migration workflow
- **Prisma** — server-only ORM/query layer; it no longer owns migrations
- **Google Identity Services** — Google-only customer sign-in
- **pnpm + Turborepo** — workspace tooling
- **Chart.js** — portfolio/admin analytics
- **CoinGecko** — market prices
- **Mistral** — optional AI explanations
- **IndexedDB + service worker** — offline PWA behavior

## Features preserved

- Black-and-white SaaS landing page
- Installable mobile-first PWA
- Google-only customer login
- HttpOnly signed customer session
- Separate secure control-panel login
- Admin dashboard, user controls, landing CMS, AdSense policy, and audit log
- BUY / SELL / TRANSFER / REWARD / AIRDROP / FEE / ADJUSTMENT ledger
- Weighted average cost and break-even
- Realized/unrealized P/L
- Multi-currency ledger with FX-to-base values
- CoinGecko market snapshots with graceful fallback
- Offline cached portfolio and queued transactions
- Optional Mistral analytics explanations
- SEO metadata, sitemap, robots, JSON-LD, and PWA manifest

## Repository structure

```text
apps/
  web/
    app/
      api/[...path]/route.ts   # Next.js backend API
      app/                     # Signed-in PWA
      admin/                   # Control panel
    lib/
      server/                  # Prisma, auth, business services
    prisma/
      schema.prisma            # ORM model only
      seed.ts
    components/
    public/
    styles/

packages/
  core/                        # Pure cost-basis/ledger calculation engine

supabase/
  config.toml
  migrations/                  # Single source of truth for DB schema

docs/
  VERCEL_SUPABASE_DEPLOYMENT.md
  SCALING.md
```

## Supabase project

The repository is configured for project ref:

```text
nzjpqochvjsnbqlzsflv
```

The Supabase URL and publishable key may be exposed to browser code. The PostgreSQL password, connection strings, service-role keys, OAuth secrets, and session secrets must never be committed.

The database password previously shared in chat should be rotated before production use.

## Local setup

Requirements:

- Node.js 22+
- pnpm 10+
- Supabase account/project access

```bash
corepack enable
pnpm install
cp .env.example apps/web/.env
```

Fill in the server-only secrets in `apps/web/.env`.

Authenticate and link the CLI once:

```bash
pnpm supabase:login
pnpm supabase:link
```

Preview and apply migrations:

```bash
pnpm db:push:dry-run
pnpm db:push
```

Generate Prisma and run:

```bash
pnpm db:generate
pnpm dev
```

Open:

- App: http://localhost:3000
- API health: http://localhost:3000/api/health
- Control panel: http://localhost:3000/admin

## Creating future database changes

Do not create Prisma migrations. Use Supabase migrations:

```bash
pnpm db:new add_portfolio_feature
```

Edit the new SQL file under `supabase/migrations/`, then run:

```bash
pnpm db:push:dry-run
pnpm db:push
```

Keep `apps/web/prisma/schema.prisma` synchronized with the SQL schema because Prisma remains the server query layer.

## Security model

All portfolio and control-panel tables have PostgreSQL Row Level Security enabled. There are intentionally no browser Data API policies for these tables; browser requests go through Next.js Route Handlers and business services.

The browser never receives `DATABASE_URL`, `DIRECT_URL`, database passwords, or control-panel/session secrets.

## Tests

```bash
pnpm --filter @crypto-dca/core test
pnpm --filter @crypto-dca/web test
pnpm --filter @crypto-dca/web typecheck
pnpm --filter @crypto-dca/web build
```

GitHub Actions applies the committed Supabase migrations to a clean PostgreSQL 17 service before validating Prisma, typechecking, and building.

## Vercel

Import `curib123/Crypto-DCA-Tracking-App` and use:

- Root Directory: `apps/web`
- Framework Preset: **Next.js**
- Build Command: `cd ../.. && pnpm --filter @crypto-dca/web build`
- Output Directory: `.next`

Add the production environment variables from `.env.example` in Vercel. Do not put private values in the repository.

See [docs/VERCEL_SUPABASE_DEPLOYMENT.md](docs/VERCEL_SUPABASE_DEPLOYMENT.md) for the complete setup.
