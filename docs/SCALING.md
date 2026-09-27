# Scaling and Production Architecture

## Target

The current production target is approximately **1,000 registered users** on a single Dockerized Oracle VM while preserving a zero-paid-service baseline where provider terms and free-tier availability permit it.

This document describes the engineering decisions behind that target. It is not a promise that every Oracle region or third-party free tier will always have capacity.

## Architecture

```
Browser / Installed PWA
        |
        | HTTPS
        v
      Caddy
        |
   +----+----+
   |         |
Next.js   NestJS API
             |
             +--------------------+
             |                    |
        PostgreSQL          MarketService
                                  |
                           MarketProvider port
                                  |
                        CoinGecko adapter
```

The API is organized around feature and infrastructure boundaries:

```
src/
  common/
    security/

  infrastructure/
    database/
    rate-limit/

  modules/
    auth/
    market/
    portfolio/
    transactions/
```

Financial calculation rules remain in the shared pure package:

```
packages/core
```

This keeps accounting logic independent from NestJS, PostgreSQL, HTTP, Google, or CoinGecko.

## Google-only authentication

Production authentication uses Google Identity Services only.

Flow:

```
Google Identity Services
        |
        | ID token
        v
POST /api/auth/google
        |
GoogleIdentityService
        |
google-auth-library verifyIdToken()
        |
AuthService
        |
User keyed by Google `sub`
        |
SessionService
        |
HttpOnly SameSite cookie
```

The app never uses the Google email address as the stable identity key. The stable Google `sub` claim is persisted as `googleSubject`.

The PWA does not store the Google ID token or app JWT in localStorage or IndexedDB.

Required production environment values:

```
GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
JWT_SECRET=at-least-32-random-characters
```

The selected Google Identity Services ID-token flow does not require a Google client secret in this application.

Configure the production site origin in Google Auth Platform as an authorized JavaScript origin, for example:

```
https://dca.example.com
```

Local development can use:

```
http://localhost:3000
```

## Market data for 1,000 users

### Rule: users never call CoinGecko directly

All market requests go:

```
1,000 users
    |
    v
NestJS /market/prices
    |
    v
ONE shared MarketService snapshot
    |
    v
CoinGecko
```

The number of CoinGecko requests therefore does **not** scale linearly with user count.

### One request includes all supported assets and currencies

The CoinGecko adapter requests all supported crypto IDs and all supported display currencies in a single `/simple/price` request.

Current supported assets:

- BTC
- ETH
- SOL
- BNB
- LINK
- HYPE
- XLM

Current display currencies:

- USD
- PHP
- EUR
- GBP
- AUD
- CAD
- SGD
- JPY
- KRW
- MYR
- IDR
- THB
- USDT
- USDC

USDT and USDC display values currently reuse the USD quote because they are treated as USD-denominated display currencies for portfolio presentation.

### Free quota math

The shared snapshot TTL is 15 minutes.

Worst-case continuous upstream refresh rate for one API process:

```
4 refreshes/hour
x 24 hours
x 30 days
= 2,880 CoinGecko requests/month
```

This is below the current 10,000 monthly-call Demo allowance, leaving headroom for restarts, testing, and provider errors.

The important property is:

```
10 users   -> <= ~2,880 scheduled-demand refreshes/month
100 users  -> <= ~2,880 scheduled-demand refreshes/month
1,000 users -> <= ~2,880 scheduled-demand refreshes/month
```

User count increases requests to **your NestJS API**, not to CoinGecko.

## Market reliability controls

The market subsystem includes:

### Request coalescing

If 500 users request stale market data at the same moment, only one provider refresh promise is created.

### Stale-while-revalidate

If a cached snapshot has expired but is less than 24 hours old:

1. the user immediately receives the cached snapshot,
2. one background refresh starts,
3. other users continue using the stale snapshot instead of waiting.

### Circuit breaker

After repeated provider failures, the provider circuit temporarily opens so the API does not hammer CoinGecko during an outage.

### Last-entry portfolio fallback

If no market snapshot is available, portfolio accounting still works. Current market value falls back to the user's most recent recorded entry price.

The transaction ledger remains the source of truth regardless of provider availability.

## Rate limiting

Rate limiting is performed inside NestJS without Redis.

Authenticated requests are tracked using a SHA-256-derived identifier from the HttpOnly app session cookie rather than only by public IP.

This matters for mobile users because hundreds of legitimate devices can share a carrier-grade NAT address.

Fallback tracking for unauthenticated requests uses client IP.

Current policy:

- global API: 120 requests/minute per session/IP tracker
- Google sign-in: 30 requests/minute per unauthenticated IP
- market prices: 30 requests/minute per authenticated session

These are abuse ceilings, not expected application traffic.

## Database design

PostgreSQL remains the authoritative persistent store.

Relevant indexes already include:

- user + transaction date
- user + asset symbol
- user + client transaction reference
- unique user email
- unique Google subject

Offline transaction creation is idempotent through `clientReference`.

A retried request cannot create the same DCA transaction twice for the same user.

## Offline architecture

IndexedDB is a device cache, never the accounting authority.

```
Offline entry
   |
IndexedDB pending queue
   |
internet returns
   |
NestJS validation
   |
PostgreSQL
   |
fresh portfolio snapshot
   |
IndexedDB read cache
```

Pending writes synchronize in chronological ledger order.

Official portfolio totals are refreshed only after server acceptance.

## Single-instance recommendation for the zero-cost target

For the initial 1,000-user target, run **one API replica**.

The market snapshot is in process memory. Multiple API replicas would each maintain their own provider snapshot and therefore multiply CoinGecko usage.

Approximate maximum at constant activity:

```
1 replica  ~2,880 calls/month
2 replicas ~5,760 calls/month
3 replicas ~8,640 calls/month
4 replicas ~11,520 calls/month
```

For horizontal scaling beyond this, move the market snapshot/refresh lease to a shared store.

A future no-paid-service option is PostgreSQL-backed shared market snapshots plus a PostgreSQL advisory lock for one refresh leader.

Redis is intentionally not required by the current architecture.

## Capacity considerations for 1,000 users

1,000 registered users does not mean 1,000 simultaneous requests.

The application is suitable for this target because:

- pages are mostly read-heavy,
- DCA transaction writes are low frequency,
- calculations are per-user,
- market provider calls are centralized,
- static assets are served by Next.js/Caddy,
- offline caching reduces repeated reads,
- database queries are indexed.

Before a larger public launch, load-test the actual Oracle VM using realistic concurrency rather than estimating only from registered-user count.

Recommended scenarios:

- 20 concurrent users
- 50 concurrent users
- 100 concurrent users
- burst of 500 market reads
- burst of 100 portfolio reads
- 50 simultaneous transaction writes

Measure:

- p50/p95/p99 API latency
- CPU
- memory
- PostgreSQL connections
- event-loop lag
- 5xx rate
- provider refresh count

## Horizontal-scale boundary

Add a second API replica only when measurements show the single API process is the bottleneck.

Before going to 4+ API replicas, implement a shared market snapshot because otherwise the free CoinGecko monthly quota can be exceeded.

At larger scale, likely additions are:

- shared distributed cache/lease
- background job worker
- connection pooler such as PgBouncer
- centralized logs/metrics
- managed backups
- separate database host

These are deliberately excluded from the zero-cost MVP until measurements justify them.

## Provider licensing

Free quota capacity and commercial licensing are separate questions.

CoinGecko's current Demo plan is technically sufficient for this request pattern, but provider terms/licensing can change. Review the current CoinGecko licensing/attribution requirements before commercial monetization or a public production launch.

The provider adapter exists specifically so CoinGecko can be replaced without changing portfolio/domain logic.
