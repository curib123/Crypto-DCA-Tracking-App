# Scaling Notes

NextFi is now a serverless full-stack Next.js application backed by Supabase PostgreSQL.

## Request path

\`\`\`
PWA / browser
    |
    v
Vercel CDN + Next.js
    |
    +-- static/SSR pages
    |
    +-- /api Route Handlers
            |
            +-- Prisma
            |     |
            |     v
            |  Supabase transaction pooler
            |     |
            |     v
            |  PostgreSQL
            |
            +-- CoinGecko
            +-- optional Mistral API
\`\`\`

## Database connections

Vercel functions are short-lived and can scale horizontally. Production runtime therefore uses Supabase's transaction pooler through \`DATABASE_URL\`.

Prisma migration commands use \`DIRECT_URL\`, which should be a Supabase session-pooler or direct connection.

Do not configure Vercel functions to connect directly to PostgreSQL with an unbounded connection pool.

## Stateless backend rule

The durable source of truth is PostgreSQL. Route Handlers must not depend on process memory for correctness.

Current in-memory caches and rate counters are only optimizations. A new Vercel instance may start with an empty cache, which must not change portfolio or ledger results.

If traffic grows enough that globally shared rate limiting/cache state is required, add a managed Redis-compatible service without moving the core business rules out of Next.js.

## Market API protection

The market endpoint:

- limits requested assets to the supported list
- coalesces refreshes within one function instance
- caches a market snapshot for a short window
- can serve a stale snapshot after temporary provider failure
- falls back to the last ledger price for portfolio calculations when live market data is unavailable

For higher traffic, put the market snapshot in shared cache/storage so all Vercel instances reuse one provider fetch window.

## Financial calculations

Cost basis, holdings, realized P/L, and ledger validation remain deterministic functions in \`packages/core\`.

AI is not allowed to calculate or mutate authoritative portfolio balances. Mistral receives already-derived analytics only.

## Growth boundary

This architecture should be kept until there is evidence that a separate service is needed. Extract a worker or service only for a concrete reason such as:

- long-running jobs that exceed serverless execution characteristics
- scheduled batch processing at meaningful scale
- very high shared-cache/rate-limit traffic
- event-driven workloads requiring queues
- independent backend deployment requirements

The current design avoids paying the complexity cost of NestJS + VPS orchestration before those needs exist.
