# NextFi — Crypto DCA Tracking App

A mobile-first Progressive Web App for tracking real crypto DCA contributions, weighted average cost, break-even, fees, current value, and realized/unrealized profit or loss. NextFi includes an admin control panel, CMS-managed landing content, system-aware light/dark themes, Chart.js analytics, and optional AI-assisted portfolio explanations.

## What is implemented

- Modern black-and-white SaaS landing page using the NextFi brand
- System / Light / Dark themes; System follows `prefers-color-scheme` automatically
- Admin-managed landing copy, features, FAQ, footer, and SEO metadata
- Theme-aware Chart.js portfolio and admin analytics
- Optional AI-assisted portfolio explanations backed by deterministic ledger calculations
- Secure username/password control panel with forced bootstrap-password change and login lockout
- Admin dashboard, user management, suspension controls, per-user ad policy, and audit log
- Google AdSense integration prepared but OFF by default, with global/all-user/selected-user controls
- Installable PWA manifest + service worker
- Google-friendly metadata, canonical URL, robots, sitemap, FAQ JSON-LD, and SoftwareApplication JSON-LD
- Google Identity Services sign-in only; no application password database
- HttpOnly-cookie JWT-protected app routes
- PostgreSQL transaction ledger
- Weighted DCA cost-basis engine
- BUY / SELL / TRANSFER / REWARD / AIRDROP / FEE transaction types
- Actual invested amount
- Average entry and break-even
- Realized and unrealized P/L
- Multi-currency transaction fields with FX-to-base rate
- Shared CoinGecko market snapshot with request coalescing, stale-while-revalidate, circuit breaking, and last-entry fallback
- IndexedDB offline transaction queue
- Responsive desktop/mobile SaaS dashboard
- Dockerized monorepo
- Oracle Cloud production Compose stack with automatic HTTPS through Caddy
- CI calculation, offline, scaling, typecheck, migration, Docker, and live API smoke tests

## Architecture

```
apps/
  web/         Next.js 16 PWA + landing page + authenticated UI
  api/
    src/
      common/
      infrastructure/
        database/
        rate-limit/
      modules/
        admin/
        ai/
        auth/
        content/
        market/
        portfolio/
        settings/
        transactions/

packages/
  core/        Pure cost-basis and DCA calculation engine

infrastructure/
  Caddyfile
  oracle/

docs/
  SCALING.md
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

Controllers do not own financial calculation logic. The reusable weighted-cost engine lives in `packages/core`. AI never calculates cost basis, P/L, or holdings; it receives a derived analytics context and is limited to explaining the already-calculated numbers.

The NestJS app is separated into feature modules and infrastructure adapters. Market data is accessed through a provider port so CoinGecko can be replaced without changing portfolio logic.

See [docs/SCALING.md](docs/SCALING.md) for the 1,000-user design, quota math, rate limits, and horizontal-scaling boundary.

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

The seed creates example ledger data only. Authentication remains Google-only; there is no demo password.

## Run without Docker

Start PostgreSQL first, configure `DATABASE_URL`, then:

```bash
corepack enable
pnpm install
pnpm db:generate
pnpm --filter @crypto-dca/api prisma:push
pnpm dev
```

## Google Sign-In configuration

Authentication uses Google Identity Services in the browser and Google's official Node.js auth library on the API.

Create one **Web application** OAuth client in Google Auth Platform and configure authorized JavaScript origins such as:

```
http://localhost:3000
https://your-production-domain.example
```

Set the same Web Client ID in both server and public web configuration:

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

The backend verifies every Google ID token and persists Google's stable `sub` claim as the account identity. The app then creates its own HttpOnly session cookie.

This selected ID-token flow does **not** require a Google client secret in the repository or Docker environment.


## Secure control-panel access

The customer app still uses Google sign-in, but the **control panel uses a completely separate username/password session**. Google user roles do not grant control-panel access.

For development only, the bootstrap credentials default to:

```
CONTROL_PANEL_USERNAME=admin
CONTROL_PANEL_PASSWORD=pass
```

The first control-panel login is forced to change the bootstrap password before any admin API can be used. New passwords must be at least 12 characters and include uppercase, lowercase, a number, and a symbol.

Production intentionally refuses to start when the bootstrap password is still `pass`, is shorter than 12 characters, or when a separate control-panel signing secret is not configured:

```
CONTROL_PANEL_USERNAME=your-admin-name
CONTROL_PANEL_PASSWORD=<strong-bootstrap-password>
CONTROL_PANEL_JWT_SECRET=<different-random-secret-at-least-32-characters>
```

The control panel uses a separate short-lived HttpOnly, Secure, SameSite=Strict cookie. Failed logins are rate-limited and five consecutive failures temporarily lock the account. The bootstrap env password is used only to create the initial database admin record; password changes are stored as a salted scrypt hash.

Control-panel pages are noindex/noarchive, served with no-store headers, and production browser source maps are disabled. Frontend JavaScript can never be made impossible to inspect, so authorization, credentials, ad policy, and sensitive business rules remain server-side.

## Google AdSense setup

AdSense is **wired but disabled by default**. Put only the AdSense publisher identifiers in environment configuration:

```
ADSENSE_CLIENT_ID=ca-pub-1234567890123456
ADSENSE_APP_SLOT_ID=1234567890
ADSENSE_LANDING_SLOT_ID=9876543210
```

The control panel at `/admin/ads` can then control:

- master ON/OFF for every ad request
- signed-in app ads ON/OFF
- landing-page ads ON/OFF
- all inherited users ON/OFF
- individual user override: Inherit / Force on / Force off

This makes two common modes easy:

- **Selected users only:** master ON + app ON + default users OFF, then set chosen users to Force on.
- **All users except exclusions:** master ON + app ON + default users ON, then set chosen users to Force off.

The PWA refreshes its effective ad policy periodically and when the tab becomes visible, so per-user changes do not require redeploying the app.

NextFi serves `/ads.txt` automatically when a valid `ADSENSE_CLIENT_ID` is configured. The AdSense loader is injected only after the server says the current placement/user is enabled. Portfolio holdings, transactions, and AI insight content are not passed to NextFi's AdSense policy layer.

Before serving personalized ads in jurisdictions where consent is required, configure the appropriate Google-certified consent management flow in AdSense Privacy & messaging.

## Mistral AI insights

NextFi uses the **Mistral Chat Completions API** for optional AI-assisted portfolio explanations. The default endpoint and model are:

```
MISTRAL_API_URL=https://api.mistral.ai/v1/chat/completions
MISTRAL_MODEL=mistral-small-latest
```

Add your Mistral API key only on the server:

```
MISTRAL_API_KEY=your-mistral-api-key
```

Optional reliability settings:

```
MISTRAL_TIMEOUT_MS=12000
MISTRAL_MAX_RETRIES=1
```

If `MISTRAL_API_KEY` is blank, unavailable, rate-limited, or the Mistral request fails, the Insights screen automatically falls back to deterministic analytics-only observations such as portfolio concentration, DCA cadence, tracked fee impact, and position status.

The Mistral API key is never exposed to the PWA. The model receives a reduced analytics context containing portfolio totals, asset-level calculated values, and deterministic observations—not wallet keys, seed phrases, or custody credentials. Mistral does not calculate NextFi's cost basis or P/L; those numbers continue to come from the ledger calculation engine. AI requests are throttled, cached for 10 minutes per user, time-limited, and retry only on transient provider errors.


## Multi-currency model

Each transaction stores:

- original amount spent
- original quote currency
- FX rate to the user's base currency
- fee in base currency

This keeps the original transaction intact while allowing consistent portfolio reporting.

For a purchase already denominated in the user's base currency, use an FX rate of `1`.

## Theme behavior

The default preference is **System**, so NextFi automatically follows the operating system/browser light or dark preference. Users can override it with **Light** or **Dark**. The preference is stored locally for instant startup and synchronized to the signed-in account for use on another device. A small pre-render bootstrap applies the theme before React mounts to avoid a light-theme flash for dark-mode users.

Charts, inputs, tables, landing content, authentication, app screens, and admin screens all consume centralized semantic theme tokens.

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
- If sign-out happens offline, a local pending-logout marker prevents the existing HttpOnly server cookie from silently reactivating the session. The server logout is retried on the next connection.
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
CONTROL_PANEL_USERNAME=<admin-username>
CONTROL_PANEL_PASSWORD=<strong-bootstrap-password>
CONTROL_PANEL_JWT_SECRET=<separate-long-random-secret>
GOOGLE_CLIENT_ID=<google-web-client-id.apps.googleusercontent.com>
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<google-web-client-id.apps.googleusercontent.com>
DEFAULT_BASE_CURRENCY=USD
```

Optional but recommended for live market data:

```
COINGECKO_DEMO_API_KEY=<free-demo-key>
```

Optional Mistral-powered portfolio explanations:

```
MISTRAL_API_KEY=<your-mistral-api-key>
MISTRAL_MODEL=mistral-small-latest
```

CoinGecko's Demo key and the Mistral API key must stay server-side and are never exposed to the PWA.

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

- Production refuses to start with a missing/short JWT secret
- Google sign-in and API routes have in-memory rate limiting; authenticated limits are keyed by verified app user identity, with IP fallback
- Google ID tokens are verified server-side and are not persisted as application sessions
- JWT sessions are stored in HttpOnly, SameSite cookies rather than browser localStorage
- JWT-protected portfolio/transaction routes
- Separate control-panel authentication and signing secret
- Salted scrypt control-panel password hashes
- Forced first-login password change, brute-force throttling, and temporary lockout
- Server-side authorization for every admin mutation
- Control-panel audit logging
- DTO validation and unknown-field rejection
- CORS origin configuration
- HTTPS in production
- PostgreSQL is internal in production Compose
- Security headers at Next.js and Caddy layers
- No wallet seed phrase or private-key collection
- No crypto custody or trade execution
- Production browser source maps disabled; no secrets or admin authorization logic trusted to the client
- AdSense master switch defaults OFF and effective ad decisions are made server-side

Before a larger commercial launch, add formal privacy/terms review, centralized audit/event storage, monitored backups, observability, and—if multiple API replicas are introduced—a shared rate-limit/cache layer.

## Market data

The API uses CoinGecko's free **Demo/public** simple-price endpoint. Users never call CoinGecko directly. One backend request retrieves all supported assets and display currencies, then a 15-minute shared snapshot serves all users. Concurrent refreshes coalesce to one provider request, expired data can be served stale while one refresh runs, and repeated provider failures open a temporary circuit breaker. No paid market-data plan is required for the current one-replica target. If `COINGECKO_DEMO_API_KEY` is configured, it stays server-side. Supported assets:

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

NextFi is portfolio tracking and analytics software. It does not custody cryptocurrency, execute trades, guarantee investment returns, or replace professional financial advice.


## Production branch CI/CD

The repository uses `master` for integration and a dedicated `production` branch for releases.

```text
feature branches → master → production → CI → Oracle Cloud
```

Every push or merge to `production` runs the complete CI suite. Oracle deployment starts automatically only after that production CI succeeds, and it deploys the exact commit SHA that passed the tests.

The manual Oracle deployment action remains available and deploys the current `production` branch.

See `docs/ORACLE_DEPLOYMENT.md` for the Oracle secrets, DNS, firewall, Google OAuth, and release setup.
