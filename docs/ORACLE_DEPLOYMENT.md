# Oracle Cloud Free production deployment

NextFi is prepared to deploy from GitHub Actions to an Oracle Compute VM without storing SSH keys or production credentials in the repository.

## One-time Oracle setup

Create an Oracle Compute instance using Ubuntu or Debian and attach a public IPv4 address.

In the Oracle VCN/security rules, allow inbound TCP:

- 22 from your administration IP range when possible
- 80 from the internet
- 443 from the internet

Point the production domain's DNS A record to the Oracle public IPv4 address before the first HTTPS deployment. Caddy obtains and renews TLS automatically.

## GitHub production secrets

In the GitHub repository, open:

Settings → Secrets and variables → Actions → New repository secret

Create these secrets:

- `ORACLE_HOST` — Oracle VM public IPv4/DNS name
- `ORACLE_USER` — SSH user, commonly `ubuntu` for an Ubuntu image
- `ORACLE_SSH_PRIVATE_KEY` — private key matching the VM's authorized public key
- `ORACLE_SSH_PORT` — optional; defaults to 22
- `ORACLE_ENV_FILE` — the complete production `.env` contents

Do not paste the private SSH key into chat and do not commit it to Git.

## Production env example

Store the following as the value of `ORACLE_ENV_FILE`, replacing every placeholder:

```env
NODE_ENV=production

APP_DOMAIN=nextfi.example.com

POSTGRES_DB=nextfi
POSTGRES_USER=nextfi
POSTGRES_PASSWORD=<strong-random-password>

JWT_SECRET=<random-secret-at-least-32-characters>
CONTROL_PANEL_USERNAME=<private-admin-username>
CONTROL_PANEL_PASSWORD=<strong-bootstrap-password-not-pass>
CONTROL_PANEL_JWT_SECRET=<different-random-secret-at-least-32-characters>

GOOGLE_CLIENT_ID=<google-web-client-id.apps.googleusercontent.com>
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<same-google-web-client-id.apps.googleusercontent.com>
DEFAULT_BASE_CURRENCY=USD

COINGECKO_DEMO_API_KEY=

MISTRAL_API_KEY=
MISTRAL_MODEL=mistral-small-latest
MISTRAL_API_URL=https://api.mistral.ai/v1/chat/completions
MISTRAL_TIMEOUT_MS=12000
MISTRAL_MAX_RETRIES=1

ADSENSE_CLIENT_ID=
ADSENSE_APP_SLOT_ID=
ADSENSE_LANDING_SLOT_ID=
```

AdSense can remain blank and disabled until the site is approved.

## Google login

Before production sign-in is used, add the final HTTPS domain to the Google OAuth web application's authorized JavaScript origins.

## Deploy

The `Deploy to Oracle Free` workflow is intentionally manual for the first production release. Open GitHub → Actions → Deploy to Oracle Free → Run workflow after the Oracle VM, DNS, firewall rules, and production secrets are ready.

After the first successful production deployment is verified, automatic deployment from successful `master` CI can be enabled separately if desired.

The workflow:

1. installs Docker Engine and Compose on a fresh supported VM if needed;
2. transfers the current `master` source over SSH;
3. writes the production env with mode 600;
4. builds and starts PostgreSQL, API, Next.js and Caddy;
5. runs an internal API health check;
6. checks the public HTTPS health endpoint when DNS is ready.

The production database and Caddy certificates are Docker named volumes and are not overwritten by application deployments.
