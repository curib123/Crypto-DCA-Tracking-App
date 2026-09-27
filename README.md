# Crypto DCA Tracking App

A mobile-first Progressive Web App for tracking real crypto DCA contributions, weighted average entry price, break-even, fees, current value, and realized/unrealized profit or loss.

## What is implemented

- Modern black-and-white SaaS landing page
- Installable PWA manifest + service worker
- Google-friendly metadata, canonical URL, robots, sitemap, FAQ JSON-LD, and SoftwareApplication JSON-LD
- Email/password registration and login
- HttpOnly-cookie JWT-protected app routes
- PostgreSQL transaction ledger
- Weighted DCA cost-basis engine
- BUY / SELL / TRANSFER / REWARD / AIRDROP / FEE transaction types
- Actual invested amount
- Average entry and break-even
- Realized and unrealized P/L
- Multi-currency transaction fields with FX-to-base rate
- CoinGecko live market prices with last-entry fallback for portfolio continuity
- IndexedDB offline transaction queue
- Responsive desktop/mobile SaaS dashboard
- Dockerized monorepo
- Oracle Cloud production Compose stack with automatic HTTPS through Caddy
- CI build/typecheck/calculation tests

## Architecture

```
apps/
  web/         Next.js 16 PWA + landing page + authenticated UI
  api/         NestJS API + Prisma/PostgreSQL

packages/
  core/        Pure cost-basis and DCA calculation engine

infrastructure/
  Caddyfile
  oracle/
```

The main calculation path is:

```
Transaction ledger
      ↓
@crypto-dca/core
      ↓
Cost basis / realized P&L
      ↓
Live market price
      ↓
Current value / unrealized P&L
```

Controllers do not own financial calculation logic. The reusable weighted-cost engine lives in `packages/core`.

## Requirements

- Node.js 22+
- pnpm 10+
- Docker + Docker Compose for the recommended setup

## Run with Docker

```bash
cp .env.example .env
docker compose up --build
```

Open:

- Web: http://localhost:3000
- API health: http://localhost:4000/api/health

The development Compose stack creates the schema automatically with `prisma db push`.

### Optional demo data

From a local pnpm environment:

```bash
pnpm install
pnpm db:generate
pnpm db:seed
```

Demo account:

```
demo@example.com
demo12345
```

Do not use the demo password in production.

## Run without Docker

Start PostgreSQL first, configure `DATABASE_URL`, then:

```bash
corepack enable
pnpm install
pnpm db:generate
pnpm --filter @crypto-dca/api prisma:push
pnpm dev
```

## Multi-currency model

Each transaction stores:

- original amount spent
- original quote currency
- FX rate to the user's base currency
- fee in base currency

This keeps the original transaction intact while allowing consistent portfolio reporting.

For a purchase already denominated in the user's base currency, use an FX rate of `1`.

## PWA behavior

The PWA now supports offline reading after the user has synchronized online at least once.

Cached in IndexedDB per user:

- last synchronized portfolio summary
- last synchronized transaction ledger
- pending offline transactions
- last synchronized market snapshot per display currency
- non-secret active-user identity needed to unlock that user's local cache

The service worker caches the public/app navigation shell and static assets needed to reopen previously used app screens without a network connection.

Offline behavior:

- Portfolio remains readable using the last synchronized snapshot.
- Transactions remain readable, and new transactions can be queued offline.
- Pending offline transactions are shown in the ledger and sync automatically when connectivity returns.
- Pending transactions are intentionally **not** included in cached portfolio totals until the server accepts them; the dashboard shows that state clearly.
- Market displays the last synchronized prices with an explicit stale/offline timestamp.
- Synchronized transaction deletion requires connectivity because ledger integrity must be checked by the server.
- Authentication secrets are never stored in IndexedDB. The JWT remains in an HttpOnly cookie.
- Explicit signing out clears that user's cached financial data from the device.
- Session expiry does **not** delete cached/pending transactions; the active offline identity is cleared and the user signs in again, after which the same user ID can resume synchronization without losing queued entries.

Authenticated API responses are not placed in the service-worker HTTP cache. Private financial data lives only in the per-user IndexedDB cache used by the application.

## SEO implementation

The landing page includes:

- descriptive title + meta description
- canonical URL
- Open Graph + Twitter metadata
- semantic heading hierarchy
- internal navigation
- crawlable product copy
- `SoftwareApplication` JSON-LD
- `FAQPage` JSON-LD
- generated `/robots.txt`
- generated `/sitemap.xml`
- installable web app manifest

Authenticated pages, login, and registration are marked `noindex`. Do not expose private portfolio pages to search crawlers.

Set the real production origin:

```
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

After deployment, add the domain to Google Search Console, submit `/sitemap.xml`, and validate structured data with Google's Rich Results Test.

## Zero-cost operating mode

The default project is intentionally designed to run without a paid SaaS dependency:

- Next.js, NestJS, PostgreSQL, Prisma, Caddy, Docker, and pnpm are used without a required paid service.
- Market prices use CoinGecko's $0 Demo/public API path; no paid CoinGecko plan is required. A free Demo key is recommended for authenticated quota access, while the app can attempt public/keyless access and falls back safely when market data is unavailable.
- The default runtime does not require Redis, a managed database, a paid auth service, an email provider, analytics, ads, or a payment gateway.
- GitHub Actions is used only for repository CI; this repository is public.
- Oracle Cloud Always Free can host the Docker stack when your tenancy has eligible capacity and you remain inside the current Always Free limits.
- A custom paid domain is **not required**. You can use a free DNS subdomain such as DuckDNS and set `APP_DOMAIN=your-name.duckdns.org` for Caddy HTTPS.

Zero-cost does **not** mean unlimited. Free providers can impose quotas, rate limits, capacity limits, or policy changes. Oracle also documents reclamation rules for idle Always Free compute, so keep backups outside the VM.

## Oracle Cloud deployment

Recommended shape:

```
Internet
   ↓
Oracle Cloud VM
   ↓
Caddy :80/:443
   ├── Next.js web
   └── NestJS /api
          ↓
      PostgreSQL
```

Only ports **80/443** should be public for the application. Do not expose PostgreSQL `5432` publicly.

### 1. Prepare the VM

On a fresh Ubuntu Oracle Compute VM:

```bash
sh infrastructure/oracle/bootstrap.sh
```

Sign out and back in once after Docker group membership changes.

### 2. Configure the application

```bash
git clone https://github.com/curib123/Crypto-DCA-Tracking-App.git
cd Crypto-DCA-Tracking-App
cp .env.example .env
```

Set at minimum:

```
APP_DOMAIN=dca.example.com
POSTGRES_DB=crypto_dca
POSTGRES_USER=crypto_dca
POSTGRES_PASSWORD=<strong-random-password>
JWT_SECRET=<long-random-secret-at-least-32-characters>
```

Optional but recommended for live market data:

```
COINGECKO_DEMO_API_KEY=<free-demo-key>
```

CoinGecko's Demo plan is $0/month. The key must stay server-side and is never exposed to the PWA.

Point the domain's DNS A/AAAA record to the VM before starting Caddy. For a zero-cost setup, a free DuckDNS subdomain can be used instead of purchasing a domain.

### 3. Deploy

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Caddy requests and renews TLS certificates automatically once DNS and Oracle ingress rules are correct.

### 4. Inspect

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
```

The production API runs the checked-in Prisma migrations before starting.

## Security baseline

- Passwords are hashed with bcrypt
- Production refuses to start with a missing/short JWT secret
- Authentication endpoints and the API have in-memory rate limiting
- JWT sessions are stored in HttpOnly, SameSite cookies rather than browser localStorage
- JWT-protected portfolio/transaction routes
- DTO validation and unknown-field rejection
- CORS origin configuration
- HTTPS in production
- PostgreSQL is internal in production Compose
- Security headers at Next.js and Caddy layers
- No wallet seed phrase or private-key collection
- No crypto custody or trade execution

Before a public commercial launch, add refresh-token rotation, email verification, password reset, rate-limit persistence, 2FA, audit/event storage, encrypted integration credentials, and a formal privacy/terms review.

## Market data

The API uses CoinGecko's free **Demo/public** simple-price endpoint. No paid market-data plan is required. If `COINGECKO_DEMO_API_KEY` is configured, the API sends it only from the backend; otherwise it attempts public/keyless access. A 15-minute shared in-memory snapshot reduces calls, and portfolio calculations fall back to the last recorded entry price if market data is unavailable. Supported assets:

- BTC
- ETH
- SOL
- BNB
- LINK
- HYPE
- XLM

If the live market provider is unavailable, the portfolio summary falls back to the last recorded entry price so ledger analytics remain usable.

## Testing

Run:

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

The shared calculation package includes tests for weighted average cost and realized P/L behavior.

## Important product principle

**Transactions are the source of truth.**

Do not persist user-editable "profit", "average entry", or "break-even" values. Recalculate them from the ledger so a corrected transaction automatically fixes downstream analytics.

## Disclaimer

Crypto DCA Tracking App is portfolio tracking software. It does not provide financial advice or guarantee investment returns.
