# Deploying CareerCraft — `craft.hiddentechdaily.com`

CareerCraft is published at **https://craft.hiddentechdaily.com** — a dedicated
subdomain that keeps it cleanly separated from the main HiddenTechDaily.com site.

---

## Architecture overview

```
Browser
  │
  ▼
nginx (host, port 443)          ← SSL termination, static files, security headers
  ├── /            → /var/www/career-craft   (React SPA, built by Vite)
  └── /api/*       → 127.0.0.1:5000          (API server, Docker)
                          │
                     docker-compose
                     ├── api   (Node 24, Express)
                     └── db    (PostgreSQL 16)
```

- The API and database run inside Docker containers, **never exposed to the public internet**.
- nginx handles SSL (Let's Encrypt), CSP headers, and Stripe security requirements.
- Card data is handled entirely by Stripe — it never touches this server.

---

## Prerequisites

| Tool | Install command |
|------|----------------|
| Ubuntu 22.04 / 24.04 LTS | — |
| Docker + Compose v2 | `curl -fsSL https://get.docker.com \| sudo sh` |
| nginx | `sudo apt install -y nginx` |
| Certbot | `sudo apt install -y certbot python3-certbot-nginx` |
| Node.js 24 | see Step 2 below |
| pnpm 10 | `npm install -g pnpm@10` |
| Git | `sudo apt install -y git` |

---

## Step 1 — DNS

In your domain registrar (wherever hiddentechdaily.com DNS is managed), add:

```
Type  Name   Value
A     craft  <your-VPS-IP>
```

Wait for propagation (usually a few minutes with Hostinger). Verify with:

```bash
dig +short craft.hiddentechdaily.com
# should print your VPS IP
```

---

## Step 2 — Install Node.js 24 on the VPS

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version      # v24.x
npm install -g pnpm@10
```

---

## Step 3 — Add yourself to the Docker group

```bash
sudo usermod -aG docker $USER
newgrp docker
docker --version    # verify
```

---

## Step 4 — Clone the repository

```bash
sudo mkdir -p /opt/career-craft
sudo chown $USER:$USER /opt/career-craft
git clone https://github.com/tlc0130/career-craft.git /opt/career-craft
cd /opt/career-craft
git checkout main
```

---

## Step 5 — Configure environment variables

```bash
cp .env.example .env
nano .env
```

**Minimum required values:**

| Variable | How to get it |
|----------|--------------|
| `POSTGRES_PASSWORD` | Strong random password — `openssl rand -hex 24` |
| `SESSION_SECRET` | `openssl rand -hex 32` |
| `OPENROUTER_API_KEY` | https://openrouter.ai/keys |
| `ALLOWED_ORIGINS` | `https://craft.hiddentechdaily.com` |
| `APP_URL` | `https://craft.hiddentechdaily.com` |

Stripe keys are optional until you're ready to enable payments (see §Security below).

---

## Step 6 — Start the database and API

```bash
cd /opt/career-craft
docker compose --env-file .env up -d --build
```

Watch the API come up:

```bash
docker compose logs -f api
# Look for: {"port":5000,"msg":"Server listening"}
```

### Run database migrations (first deploy only)

```bash
# From the host, using the local pnpm install (Step 7):
DATABASE_URL="postgres://careercraft:$(grep POSTGRES_PASSWORD .env | cut -d= -f2)@localhost:5432/careercraft" \
  pnpm --filter @workspace/db run db:push
```

---

## Step 7 — Build the React frontend

```bash
cd /opt/career-craft
pnpm install --frozen-lockfile

# Build (PORT is only used by the dev server, not the production build)
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/resume-builder run build

# Deploy static files
sudo mkdir -p /var/www/career-craft
sudo cp -r artifacts/resume-builder/dist/public/. /var/www/career-craft/
sudo chown -R www-data:www-data /var/www/career-craft
```

---

## Step 8 — Configure nginx

```bash
# Install the site config
sudo cp nginx/craft.hiddentechdaily.com.conf \
        /etc/nginx/sites-available/craft.hiddentechdaily.com

# Enable it
sudo ln -sf /etc/nginx/sites-available/craft.hiddentechdaily.com \
            /etc/nginx/sites-enabled/craft.hiddentechdaily.com

# Test (SSL cert doesn't exist yet — that's fine for now)
sudo nginx -t 2>&1 | head -3
sudo systemctl reload nginx
```

---

## Step 9 — SSL certificate (Let's Encrypt)

```bash
sudo certbot --nginx -d craft.hiddentechdaily.com
```

Certbot will:
1. Verify domain ownership via the ACME HTTP challenge
2. Issue a free certificate
3. Patch the nginx config with SSL directives
4. Set up automatic renewal via a systemd timer

After Certbot runs, restore the full security-hardened config:

```bash
sudo cp nginx/craft.hiddentechdaily.com.conf \
        /etc/nginx/sites-available/craft.hiddentechdaily.com
sudo nginx -t && sudo systemctl reload nginx
```

Verify SSL:

```bash
curl -I https://craft.hiddentechdaily.com
# HTTP/2 200 with Strict-Transport-Security header
```

---

## Step 10 — Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # ports 80 + 443
sudo ufw enable
sudo ufw status
```

The API (port 5000) is bound to `127.0.0.1` — it is **never reachable from the internet**.

---

## Stripe security & customer data protection

### How Stripe is integrated

- **Checkout** is handled by Stripe's hosted page (`stripe.com/checkout`). Your
  server creates a checkout session and redirects the user. **Card numbers, CVCs,
  and bank details never pass through this server.**
- **Webhooks** are the only path for Stripe to call back. Every webhook request is
  verified with an HMAC-SHA256 signature before any event is processed.
- **Customer PII** (name, email) lives in the PostgreSQL database, which is only
  reachable from inside Docker's private network.

### Setting up webhooks securely

1. Go to https://dashboard.stripe.com/webhooks → **Add endpoint**
2. URL: `https://craft.hiddentechdaily.com/api/stripe/webhook`
3. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
4. Copy the **Signing secret** (starts with `whsec_`)
5. Add it to `.env`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_...
docker compose --env-file .env restart api
```

The webhook handler in `artifacts/api-server/src/routes/stripe.ts` calls
`stripe.webhooks.constructEvent()`, which throws if the signature is missing or
invalid — **no event is processed without a valid signature**.

### Key security properties in production

| Control | Where it's enforced |
|---------|-------------------|
| HTTPS only | nginx HTTP→HTTPS redirect |
| HSTS (1 year) | `Strict-Transport-Security` header |
| Stripe CSP whitelist | `Content-Security-Policy` header in nginx config |
| Webhook signature verification | `stripe.webhooks.constructEvent()` in API |
| Session cookies `Secure` + `HttpOnly` + `SameSite=Strict` | `app.ts` session middleware |
| Rate limiting on auth + AI + all endpoints | Express `express-rate-limit` middleware |
| Database not internet-exposed | Docker internal network only |
| API not internet-exposed | `127.0.0.1:5000` bind, not `0.0.0.0` |
| Secrets in env vars only | Never in code or git |

### Stripe test vs live keys

- Use `sk_test_...` / `pk_test_...` keys until you've verified the full checkout
  flow end-to-end in a staging run.
- Switch to `sk_live_...` / `pk_live_...` only when ready. Live keys should only
  ever exist in the VPS `.env` file — not in `.env.example`, not in git, not in
  Slack or email.
- Rotate compromised keys immediately in the Stripe Dashboard and update `.env` +
  restart the API container.

### Keeping secrets secure

```bash
# .env is git-ignored — verify this before every push
git status    # .env must NOT appear in the output

# Restrict file permissions on the server
chmod 600 /opt/career-craft/.env

# Who can read secrets? Only your user + root
ls -la /opt/career-craft/.env
# -rw------- 1 youruser youruser ...
```

---

## Updating the app

```bash
cd /opt/career-craft

# Pull latest code
git pull origin main

# Rebuild + restart the API container
docker compose --env-file .env up -d --build api

# Rebuild + redeploy the frontend
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/resume-builder run build
sudo cp -r artifacts/resume-builder/dist/public/. /var/www/career-craft/
sudo chown -R www-data:www-data /var/www/career-craft
```

---

## Useful commands

```bash
# Live logs from all containers
docker compose logs -f

# Restart API only (e.g. after changing .env)
docker compose --env-file .env restart api

# PostgreSQL shell
docker compose exec db psql -U careercraft

# Check SSL certificate expiry
sudo certbot certificates

# Test security headers
curl -sI https://craft.hiddentechdaily.com | grep -E "strict|content-security|x-frame|x-content"

# Full rebuild from scratch
docker compose down
docker compose --env-file .env up -d --build
```
