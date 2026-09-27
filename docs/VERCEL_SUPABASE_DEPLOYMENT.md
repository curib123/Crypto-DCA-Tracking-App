# Vercel + Supabase Deployment

NextFi deploys as one full-stack Next.js application.

```text
Browser / installed PWA
        |
        v
Vercel
Next.js 16
- frontend
- Route Handlers under /api
- authentication/session logic
- portfolio/business logic
        |
        v
Prisma (server only)
        |
        v
Supabase PostgreSQL
```

Supabase CLI owns schema migrations. Prisma is only the server-side ORM/query layer.

## 1. Rotate the database password

A database password was previously shared in chat. Rotate it in Supabase before production use.

Never commit the replacement password.

If the password contains reserved URL characters such as `@`, `:`, `/`, `?`, `#`, or `%`, percent-encode it before placing it inside a PostgreSQL URL.

## 2. Project configuration

Project ref:

```text
nzjpqochvjsnbqlzsflv
```

Project URL:

```text
https://nzjpqochvjsnbqlzsflv.supabase.co
```

The publishable key and project URL are public client configuration. Database passwords, connection strings, service-role keys, Google OAuth secrets, and application session secrets are private.

## 3. Install and link Supabase CLI

From the repository root:

```bash
corepack enable
pnpm install
pnpm supabase:login
pnpm supabase:link
```

The link script runs:

```bash
supabase link --project-ref nzjpqochvjsnbqlzsflv
```

Supabase stores local link state under `.supabase/`, which is gitignored.

## 4. Configure PostgreSQL connections

In Supabase Dashboard -> **Connect**, copy the exact pooler hosts.

Use:

- `DATABASE_URL`: **Transaction Pooler**, normally port **6543**, for Vercel/serverless runtime.
- `DIRECT_URL`: **Session Pooler**, normally port **5432**, for Prisma schema validation and administrative database access.

Do not guess the pooler hostname.

The direct `db.<project-ref>.supabase.co:5432` endpoint can require IPv6, so the session pooler is the safer default for machines/networks without IPv6.

## 5. Apply schema

The authoritative migrations are in:

```text
supabase/migrations/
```

Preview first:

```bash
pnpm db:push:dry-run
```

Then apply:

```bash
pnpm db:push
```

Supabase records applied migrations in `supabase_migrations.schema_migrations`, so already-applied migrations are skipped on later pushes.

For a new migration:

```bash
pnpm db:new descriptive_name
```

Do not run `prisma migrate dev` or `prisma migrate deploy`. This repository intentionally uses one migration authority: Supabase CLI.

## 6. RLS and Data API safety

NextFi's application tables have RLS enabled and intentionally have no browser policies.

That means the Supabase publishable key cannot directly read or mutate:

- users
- transaction ledgers
- settings
- audit logs
- control-panel credentials

All application data access goes through authenticated Next.js server code using the PostgreSQL connection.

## 7. Import GitHub repo into Vercel

Import:

```text
curib123/Crypto-DCA-Tracking-App
```

Use:

- Framework Preset: **Next.js**
- Root Directory: `apps/web`
- Install Command: `pnpm install`
- Build Command: `cd ../.. && pnpm --filter @crypto-dca/web build`
- Output Directory: `.next`

## 8. Vercel environment variables

Required:

```text
DATABASE_URL
DIRECT_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
GOOGLE_CLIENT_ID
NEXT_PUBLIC_GOOGLE_CLIENT_ID
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_SITE_URL=https://your-project.vercel.app
JWT_SECRET
CONTROL_PANEL_USERNAME
CONTROL_PANEL_PASSWORD
CONTROL_PANEL_JWT_SECRET
DEFAULT_BASE_CURRENCY=USD
```

Optional:

```text
COINGECKO_DEMO_API_KEY
MISTRAL_API_KEY
MISTRAL_MODEL
MISTRAL_API_URL
MISTRAL_TIMEOUT_MS
ADSENSE_CLIENT_ID
ADSENSE_APP_SLOT_ID
ADSENSE_LANDING_SLOT_ID
```

Generate independent long random values for `JWT_SECRET` and `CONTROL_PANEL_JWT_SECRET`.

## 9. Google sign-in

In Google Auth Platform, add authorized JavaScript origins for:

```text
http://localhost:3000
https://your-project.vercel.app
https://your-custom-domain.example
```

Use the same Web Client ID for `GOOGLE_CLIENT_ID` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

## 10. Deployment flow

```text
local change
    |
    +-- code change -> git push -> GitHub -> Vercel deployment
    |
    +-- schema change -> supabase migration new
                        -> review SQL
                        -> db push --dry-run
                        -> db push
                        -> git commit/push migration
```

For production schema changes, review the SQL and dry-run before applying it.

## Architecture notes

- Browser API calls are same-origin under `/api`.
- Prisma never runs in browser code.
- Supabase CLI, not Prisma Migrate, owns migration history.
- RLS blocks direct browser access to application tables.
- The PWA, offline queue, cost-basis engine, admin panel, AdSense controls, and optional Mistral insights remain in the same Next.js deployment.
