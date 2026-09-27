# Vercel + Supabase Deployment

NextFi now deploys as one full-stack Next.js application.

\`\`\`
Browser / installed PWA
        |
        v
Vercel
Next.js 16
- pages and components
- Route Handlers under /api
- Google identity verification
- portfolio/business logic
- admin APIs
        |
        v
Supabase PostgreSQL
\`\`\`

There is no separate NestJS server, Docker host, Caddy proxy, Oracle VM, or AWS EC2 instance in the production architecture.

## 1. Create the Supabase database

Create a Supabase project, then open **Connect** in the project dashboard.

Copy both connection strings:

- **Transaction pooler** (port 6543) -> \`DATABASE_URL\`. This is the runtime connection used by Vercel/serverless functions.
- **Session pooler** (port 5432), or direct connection when available -> \`DIRECT_URL\`. Prisma uses this for migrations.

Do not commit either URL.

## 2. Install and migrate locally

\`\`\`bash
corepack enable
pnpm install
cp .env.example .env
\`\`\`

Fill in \`DATABASE_URL\` and \`DIRECT_URL\`, then run:

\`\`\`bash
pnpm db:generate
pnpm db:deploy
\`\`\`

For an empty Supabase project this creates the NextFi tables and indexes from the committed migrations.

## 3. Import the repo into Vercel

Import \`curib123/Crypto-DCA-Tracking-App\` into Vercel.

Use these project settings:

- Framework Preset: **Next.js**
- Root Directory: **apps/web**
- Install Command: **pnpm install** (default is fine)
- Build Command: **cd ../.. && pnpm --filter @crypto-dca/web build**
- Output Directory: **.next**

The app depends on \`packages/core\`, so keep the repository as a pnpm workspace.

## 4. Configure Vercel environment variables

Required:

\`\`\`text
DATABASE_URL
DIRECT_URL
GOOGLE_CLIENT_ID
NEXT_PUBLIC_GOOGLE_CLIENT_ID
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_SITE_URL=https://your-domain.example
JWT_SECRET
CONTROL_PANEL_USERNAME
CONTROL_PANEL_PASSWORD
CONTROL_PANEL_JWT_SECRET
DEFAULT_BASE_CURRENCY=USD
\`\`\`

Optional:

\`\`\`text
COINGECKO_DEMO_API_KEY
MISTRAL_API_KEY
MISTRAL_MODEL
MISTRAL_API_URL
MISTRAL_TIMEOUT_MS
ADSENSE_CLIENT_ID
ADSENSE_APP_SLOT_ID
ADSENSE_LANDING_SLOT_ID
\`\`\`

Generate long independent random values for \`JWT_SECRET\` and \`CONTROL_PANEL_JWT_SECRET\`. Do not reuse database or OAuth credentials as session secrets.

## 5. Configure Google sign-in

The current app keeps Google Identity Services for customer sign-in.

In Google Auth Platform, add:

\`\`\`text
http://localhost:3000
https://your-vercel-domain.vercel.app
https://your-custom-domain.example
\`\`\`

as authorized JavaScript origins as applicable.

Use the same Web Client ID for:

\`\`\`text
GOOGLE_CLIENT_ID
NEXT_PUBLIC_GOOGLE_CLIENT_ID
\`\`\`

## 6. Production migrations

Run database migrations before or alongside a production release:

\`\`\`bash
pnpm db:deploy
\`\`\`

\`DIRECT_URL\` is intentionally separate from the serverless transaction-pooler URL so Prisma migration operations do not run through transaction pooling.

## 7. Custom domain and CI/CD

Connect the GitHub repository to Vercel. Pushes to the configured production branch deploy automatically, while pull requests receive preview deployments.

Add your custom domain in Vercel, update \`NEXT_PUBLIC_SITE_URL\`, and add the custom origin to the Google OAuth client.

## Architecture notes

- All browser API calls are same-origin under \`/api\`.
- Server-only environment variables never use a \`NEXT_PUBLIC_\` prefix.
- Supabase is used as managed PostgreSQL; the current app does not require Supabase Auth.
- Prisma remains the database access layer.
- Google customer login and the separate control-panel login keep their existing behavior.
- The PWA, offline queue, cost-basis engine, admin panel, AdSense controls, and optional Mistral insights remain part of the application.
