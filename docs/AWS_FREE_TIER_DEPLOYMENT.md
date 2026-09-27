# AWS Free Tier / T4g production deployment

NextFi can deploy to an AWS EC2 ARM64 instance from the existing `production` branch CI/CD flow.

## Recommended EC2 shape

For the current AWS Graviton trial, use:

- Region: **Asia Pacific (Singapore) / ap-southeast-1** when available
- AMI: **Amazon Linux 2023 ARM64** or **Ubuntu Server 24.04 LTS ARM64**
- Instance type: **t4g.small**
- Storage: **20–30 GB gp3**
- Architecture: **ARM64 / Graviton2**

AWS currently advertises up to 750 t4g.small hours per month through December 31, 2026. Confirm the offer and your account-plan eligibility in the AWS Billing/Free Tier console before launching.

NextFi's Node, PostgreSQL, Caddy, and Alpine-based container images support ARM64.

## 1. Create the EC2 instance

Open AWS Console → EC2 → Launch instance.

Your current instance uses **Amazon Linux 2023**. That is supported. For new instances, choose Amazon Linux 2023 ARM64 or Ubuntu Server 24.04 LTS ARM64, then select `t4g.small`.

Create or select an SSH key pair. Keep the private key private. Do not commit it to Git and do not paste it into chat.

For the root EBS disk, 20–30 GB gp3 is appropriate for the current small deployment. Docker images and build cache use disk space, so avoid an extremely small root volume.

## 2. Security group

Allow:

- SSH / TCP 22 — your own public IP only when possible
- HTTP / TCP 80 — 0.0.0.0/0
- HTTPS / TCP 443 — 0.0.0.0/0

Do not expose PostgreSQL port 5432 or the internal Next.js/API ports publicly. Docker Compose keeps those services on its internal network.

## 3. Public IP and domain

The deployment needs a public IPv4 address or DNS name reachable by GitHub Actions.

For a custom domain, point an A record to the EC2 public IPv4 address.

If you use an automatically assigned EC2 public IPv4 address, it can change after a stop/start. A static address is operationally safer, but review current AWS public IPv4 pricing and Free Tier allowances before allocating one.

Caddy handles HTTPS automatically once DNS points to the instance and ports 80/443 are reachable.

## 4. GitHub Actions secrets

Repository → Settings → Secrets and variables → Actions.

Create:

- `AWS_EC2_HOST` — EC2 public IPv4 address or public DNS name
- `AWS_EC2_USER` — optional; defaults to `ec2-user` for Amazon Linux 2023. Use `ubuntu` for Ubuntu AMIs.
- `AWS_SSH_PRIVATE_KEY` — the private key matching the EC2 key pair
- `AWS_SSH_PORT` — optional; defaults to `22`
- `AWS_ENV_FILE` — complete production environment file

Do not store AWS access keys for this deployment. The workflow uses SSH only, so IAM access keys are not required.

## 5. Production environment

Example value for `AWS_ENV_FILE`:

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

AdSense can stay blank and disabled until the production domain is approved.

## 6. Google sign-in

Add the final production HTTPS domain to the Google OAuth web application's authorized JavaScript origins before enabling user sign-in.

## 7. Automatic deployment

The AWS workflow follows the same release gate as Oracle:

```text
feature/* → master → production → CI
                               ↓ success only
                       Deploy to AWS Free Tier
                               ↓
                         EC2 t4g.small
```

A successful CI run on `production` triggers the AWS deployment workflow automatically.

The workflow deploys the exact commit SHA that passed CI. It does not blindly deploy a newer branch head.

A manual `Deploy to AWS Free Tier` workflow is also available and deploys the current `production` branch.

If the AWS secrets are not configured, the workflow exits safely without touching a server.

## 8. Low-memory preparation

A `t4g.small` has limited RAM for building the complete Docker stack. The deployment workflow automatically creates a 2 GiB swap file when the VM has low memory and insufficient swap.

This is intended to make Docker builds more reliable for the small free-trial instance. For a larger production workload, build/push images in CI or move to a larger instance instead of relying on swap.

## 9. Cost guardrails

Before leaving the instance running:

- open AWS Billing → Free Tier and verify the active EC2 offer;
- enable Free Tier usage alerts;
- create an AWS Budget / zero-spend or low-spend alert;
- verify the EBS volume size;
- verify public IPv4 usage;
- avoid NAT Gateway, managed load balancers, and unnecessary paid services for this single-instance setup.

The EC2 trial has an end date. Plan to migrate, resize, or accept regular pricing before the offer ends.


## Amazon Linux 2023

The deployment bootstrap supports Amazon Linux 2023 directly. It installs the AWS-provided Docker engine package, enables Docker at boot, adds the current SSH user to the Docker group, and installs the Docker Compose CLI plugin when the AMI does not already provide it.

For Amazon Linux 2023, the default SSH user is `ec2-user`.
