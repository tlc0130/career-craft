# Deploying CareerCraft on Ubuntu VPS (HiddenTechDaily.com)

This guide covers deploying the full stack (API + PostgreSQL via Docker, React
frontend via nginx) on a Hostinger Ubuntu VPS with SSL via Let's Encrypt.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Ubuntu | 22.04 / 24.04 LTS | — |
| Docker | 24+ | see Step 1 |
| Docker Compose | v2 (plugin) | included with Docker |
| nginx | any | `sudo apt install nginx` |
| Certbot | any | `sudo apt install certbot python3-certbot-nginx` |
| Node.js | 24 | see Step 2 |
| pnpm | 10 | `npm i -g pnpm@10` |
| Git | any | `sudo apt install git` |

---

## Step 1 — Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker            # apply group change without re-login
docker --version         # verify
```

---

## Step 2 — Install Node.js 24

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version           # should print v24.x
npm install -g pnpm@10
```

---

## Step 3 — Clone the repository

```bash
cd /opt
sudo git clone https://github.com/tlc0130/career-craft.git
sudo chown -R $USER:$USER /opt/career-craft
cd /opt/career-craft
git checkout main        # or your production branch
```

---

## Step 4 — Configure environment variables

```bash
cp .env.example .env
nano .env                # fill in all values (see comments in the file)
```

Minimum required values:

| Variable | How to get it |
|----------|---------------|
| `POSTGRES_PASSWORD` | Make up a strong random password |
| `SESSION_SECRET` | `openssl rand -hex 32` |
| `OPENROUTER_API_KEY` | https://openrouter.ai/keys |
| `ALLOWED_ORIGINS` | `https://hiddentechdaily.com,https://www.hiddentechdaily.com` |

---

## Step 5 — Build and start the API + database

```bash
cd /opt/career-craft
docker compose --env-file .env up -d --build
docker compose logs -f api    # watch logs; Ctrl-C to exit
```

The API will be available at `http://127.0.0.1:5000` (internal only).

### Run database migrations

The first time (or after schema changes):

```bash
docker compose exec api node -e "
  import('@workspace/db').then(({ db }) =>
    import('drizzle-orm/node-postgres/migrator').then(({ migrate }) =>
      migrate(db, { migrationsFolder: './drizzle' })
    )
  )
"
```

Or use drizzle-kit from the host:

```bash
DATABASE_URL="postgres://careercraft:<PASSWORD>@localhost:5432/careercraft" \
  pnpm --filter @workspace/db run db:push
```

---

## Step 6 — Build the React frontend

```bash
cd /opt/career-craft

# Install all workspace dependencies
pnpm install --frozen-lockfile

# Build the Vite app (BASE_PATH=/ for VPS, PORT value is unused during build)
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/resume-builder run build

# Deploy static files to nginx's web root
sudo mkdir -p /var/www/career-craft
sudo cp -r artifacts/resume-builder/dist/public/. /var/www/career-craft/
sudo chown -R www-data:www-data /var/www/career-craft
```

---

## Step 7 — Configure nginx

```bash
# Copy the site config
sudo cp nginx/hiddentechdaily.com.conf /etc/nginx/sites-available/hiddentechdaily.com

# Enable the site
sudo ln -sf /etc/nginx/sites-available/hiddentechdaily.com \
            /etc/nginx/sites-enabled/hiddentechdaily.com

# Remove the default site if present
sudo rm -f /etc/nginx/sites-enabled/default

# Test the config — it will fail on SSL certs (that's OK before Certbot runs)
sudo nginx -t 2>&1 | head -5
```

---

## Step 8 — Obtain SSL certificates (Let's Encrypt)

Point your domain's DNS A record to this VPS IP first, then:

```bash
# Temporarily enable HTTP-only nginx to pass the ACME challenge
# Edit the nginx config and comment out the SSL server block, then:
sudo systemctl reload nginx

# Get the certificate
sudo certbot --nginx -d hiddentechdaily.com -d www.hiddentechdaily.com

# Certbot will automatically update and reload nginx with SSL config.
# After certbot succeeds, make sure the full nginx config is active:
sudo cp nginx/hiddentechdaily.com.conf /etc/nginx/sites-available/hiddentechdaily.com
sudo nginx -t && sudo systemctl reload nginx
```

Certbot installs a cron job that auto-renews certificates.

---

## Step 9 — Verify everything works

```bash
# API health
curl -I https://hiddentechdaily.com/api/auth/me

# Check docker containers
docker compose ps

# View API logs
docker compose logs --tail=50 api
```

Open https://hiddentechdaily.com in a browser.

---

## Updating the app

```bash
cd /opt/career-craft

# Pull latest code
git pull origin main

# Rebuild and restart the API container
docker compose --env-file .env up -d --build api

# Rebuild and redeploy the frontend
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/resume-builder run build
sudo cp -r artifacts/resume-builder/dist/public/. /var/www/career-craft/
sudo chown -R www-data:www-data /var/www/career-craft
```

---

## Stripe webhook setup

After deployment, register your webhook endpoint in the Stripe Dashboard:

- URL: `https://hiddentechdaily.com/api/stripe/webhook`
- Events to listen for: `checkout.session.completed`, `customer.subscription.deleted`

Copy the **Webhook Signing Secret** and add it to `.env` as `STRIPE_WEBHOOK_SECRET`,
then restart the API:

```bash
docker compose --env-file .env restart api
```

---

## Useful commands

```bash
# Tail all logs
docker compose logs -f

# Restart API only
docker compose restart api

# Connect to PostgreSQL
docker compose exec db psql -U careercraft

# Rebuild everything from scratch
docker compose down
docker compose --env-file .env up -d --build

# Check disk usage
docker system df
```

---

## Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # 80 + 443
sudo ufw enable
sudo ufw status
```

The API port 5000 is bound to `127.0.0.1` only — it is **not** exposed to the internet.
