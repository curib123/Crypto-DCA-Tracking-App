# Scaling Notes

NextFi is a serverless full-stack Next.js application backed by Supabase PostgreSQL.

## Request path

```text
PWA / browser
    |
    v
Vercel CDN + Next.js
    |
    +-- static/SSR pages
    |
    +-- /api Route Handlers
            |
            +-- Prisma (server-only ORM)
            |     |
            |     v
            |  Supabase transaction pooler
            |     |
            |     v
            |  PostgreSQL
            |
            +-- CoinGecko
            +-- optional Mistral API
```

## Database connections

Vercel functions are short-lived and scale horizontally. Runtime traffic therefore uses Supabase's transaction pooler through `DATABASE_URL`.

`DIRECT_URL` is reserved for schema validation/administrative access using the session pooler or a direct connection where supported.

Schema changes are committed as SQL under `supabase/migrations` and deployed with Supabase CLI. Prisma Migrate is not used.

Do not configure Vercel functions with an unbounded direct PostgreSQL connection pool.

## Data API boundary

Application tables have RLS enabled with no direct browser policies. The public Supabase key therefore does not expose portfolio, user, settings, audit, or control-panel rows.

Browser clients call same-origin Next.js endpoints; server code performs database work through Prisma.

## Stateless backend rule

PostgreSQL is the durable source of truth. Route Handlers must not depend on process memory for correctness.

Current in-memory caches and rate counters are optimizations only. A new Vercel instance may start with an empty cache without changing portfolio or ledger results.

If traffic requires globally shared throttling/cache state, add a managed Redis-compatible service without moving core business rules out of Next.js.

## Market API protection

The market endpoint:

- limits requested assets to the supported list
- coalesces refreshes within one function instance
- caches a market snapshot briefly
- can serve a stale snapshot after temporary provider failure
- falls back to the last ledger price when live market data is unavailable

At higher traffic, move the market snapshot to shared cache/storage so instances reuse one provider fetch window.

## Financial calculations

Cost basis, holdings, realized P/L, and ledger validation remain deterministic functions in `packages/core`.

AI is not allowed to calculate or mutate authoritative portfolio balances. Mistral receives already-derived analytics only.

## Growth boundary

Keep this architecture until a separate service is justified by a concrete workload, such as:

- long-running jobs beyond serverless execution limits
- meaningful scheduled batch processing
- very high shared-cache/rate-limit traffic
- event-driven workloads requiring queues
- independent backend deployment requirements

The current design avoids the operational cost of a separate NestJS/VPS stack before those needs exist.
