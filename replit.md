# Career Craft

AI-powered career tools: resume tailoring, cover letter generation, ATS scoring, job tracking, interview prep, and skills gap analysis. Deployed at `craft.hiddentechdaily.com` on a Hostinger Ubuntu VPS behind nginx + Let's Encrypt SSL.

## Run & Operate

```bash
# Development
pnpm --filter @workspace/api-server run dev      # API server (port 5000, serves /api/*)
pnpm --filter @workspace/resume-builder run dev  # Web app (Vite, port 20047)

# Database
pnpm --filter @workspace/db run push             # Push schema changes (dev only)
pnpm --filter @workspace/db run generate         # Regenerate Drizzle types

# Build & typecheck
pnpm run build      # Typecheck + build all packages
pnpm run typecheck  # Full TS typecheck across all packages

# Stripe product seeding
pnpm --filter scripts run seed-products
```

## Environment Variables

Copy `.env.example` to `.env` and fill in all values. **Never commit `.env` to git.**

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Random 64-char secret for session signing |
| `OPENROUTER_API_KEY` | OpenRouter API key (`sk-or-v1-...`) |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_...` in prod) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |
| `STRIPE_PRO_PRICE_ID` | Stripe Price ID for Pro monthly subscription |
| `STRIPE_LIFETIME_PRICE_ID` | Stripe Price ID for Lifetime one-time purchase |
| `APP_URL` | Fully-qualified origin, e.g. `https://craft.hiddentechdaily.com` |
| `ALLOWED_ORIGINS` | Comma-separated origins, e.g. `https://craft.hiddentechdaily.com` |

### Optional

| Variable | Default | Description |
|---|---|---|
| `OPENROUTER_MODEL` | `openai/gpt-4o-mini` | OpenRouter model string |
| `STARTER_MONTHLY_AI_LIMIT` | `5` | Free AI generations per 30-day window |
| `PORT` | `5000` | API server port |
| `NODE_ENV` | `development` | Set to `production` on VPS |
| `GOOGLE_CLIENT_ID` | — | Google OAuth2 client ID (enables Google login) |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth2 client secret |

### VPS security checklist
- `chmod 600 /opt/career-craft/.env` — only `www-data`/deploy user reads it
- Live Stripe keys (`sk_live_...`) exist **only** in VPS `.env` — not in `.env.example`, not in git, not in Slack/email
- Card data never touches the server — Stripe Checkout handles all payment capture

## Stack

- **Runtime**: Node.js 24, TypeScript 5.9, pnpm workspaces
- **API**: Express 5, sessions in PostgreSQL (`connect-pg-simple`), bcrypt, pino, `express-rate-limit`
- **Web**: React 19, Vite 7, Tailwind CSS v4, Wouter, TanStack Query, shadcn/ui
- **Database**: PostgreSQL 16 + Drizzle ORM
- **AI**: OpenRouter API (OpenAI-compatible, streamed over Server-Sent Events)
- **Payments**: Stripe (Pro monthly subscription + one-time Lifetime)
- **Deployment**: Docker Compose (API + Postgres), nginx reverse proxy, Let's Encrypt SSL
- **Build**: esbuild (API → self-contained ESM bundle)

## Where Things Live

```
lib/
  db/src/schema/schema.ts    # DB schema (single source of truth)
  db/src/index.ts            # Drizzle client + Zod schemas exported from @workspace/db

artifacts/
  api-server/src/
    app.ts                   # Express app: CORS, sessions, rate limiters, router
    routes/
      auth.ts                # /api/auth/* — register, login, logout, me, Google OAuth, GDPR
      ai.ts                  # /api/ai/* — all AI generation endpoints
      resumes.ts             # /api/resumes/* — CRUD for saved resumes
      jobs.ts                # /api/jobs/* — job application CRUD
      stats.ts               # /api/stats — dashboard stats
      stripe.ts              # /api/stripe/* — checkout, portal, webhook
      health.ts              # /api/health
    middlewares/
      auth.ts                # requireAuth guard
      rateLimit.ts           # generalLimiter, authLimiter, aiLimiter, aiHelperLimiter
    lib/
      creditPolicy.ts        # Pure: checks if user can generate (plan + credits)
      aiCredits.ts           # DB-backed: consumes / checks credits
      logger.ts              # Pino instance
      openrouter.ts          # OpenAI client configured for OpenRouter base URL

  resume-builder/src/
    pages/
      Home.tsx               # Marketing page (logged-out) / personalized dashboard (logged-in)
      Login.tsx              # Email/password + Google OAuth button
      Builder.tsx            # Full resume editor (contact, experience, education, skills)
      MyResumes.tsx          # Saved resumes list
      Tailor.tsx             # Resume tailoring (paste resume + JD → AI rewrite)
      CoverLetter.tsx        # Cover letter generator with tone selector
      ATSScore.tsx           # ATS keyword scoring + Skills Gap tab
      JobTracker.tsx         # Kanban job tracker (7 status columns)
      InterviewPrep.tsx      # AI interview question generator by category
      Profile.tsx            # Account info, plan/usage, data export, account deletion
    components/
      templates/             # 5 layout components × 5 color themes = 25 resume templates
      TemplateSelector.tsx   # Grid picker with layout + theme filters
      Layout.tsx             # App shell with responsive nav
    lib/
      auth.tsx               # useAuth hook, AuthProvider
      pdf-print.tsx          # printResume(): server-side render → print popup
      docx-export.ts         # DOCX export (client-side)

nginx/
  craft.hiddentechdaily.com.conf   # SSL, security headers, SSE proxy, static caching

DEPLOY.md                          # Step-by-step VPS deployment guide
```

## API Routes

### Auth (`/api/auth`)
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create account; owner email gets lifetime plan automatically |
| POST | `/auth/login` | Email/password login; guards against Google-only accounts |
| POST | `/auth/logout` | Destroy session |
| GET | `/auth/me` | Current user (id, email, name, phone, plan, lifetimeAccess) |
| PUT | `/auth/me` | Update name and/or phone |
| GET | `/auth/google` | Redirect to Google OAuth2 consent screen |
| GET | `/auth/google/callback` | OAuth2 callback; upserts user; links Google ID to existing email |
| GET | `/auth/export-data` | GDPR data export (JSON attachment: profile + resumes + jobs) |
| DELETE | `/auth/account` | Delete all user data (jobs → resumes → session → user row) |

### AI (`/api/ai`) — all require auth
| Method | Path | Credits | Description |
|---|---|---|---|
| POST | `/ai/tailor` | 1 credit | Stream rewritten resume (SSE) |
| POST | `/ai/cover-letter` | 1 credit | Generate cover letter with tone selector |
| POST | `/ai/ats-score` | Free | ATS keyword match score + suggestions |
| POST | `/ai/resume-score` | Free | Overall resume quality score |
| POST | `/ai/generate-summary` | Free | AI professional summary for builder |
| POST | `/ai/generate-bullets` | Free | AI bullet points for a job entry |
| POST | `/ai/interview-prep` | Free | Interview questions by category |
| POST | `/ai/skills-gap` | Free | Skills gap analysis vs job description |
| POST | `/ai/import-linkedin` | Free | Parse copy-pasted LinkedIn profile text → resume JSON |

### Jobs (`/api/jobs`) — all require auth
| Method | Path | Description |
|---|---|---|
| GET | `/jobs` | List all job applications (desc by createdAt) |
| POST | `/jobs` | Create application (Starter: 10-app limit) |
| PUT | `/jobs/:id` | Update application (verified user owns it) |
| DELETE | `/jobs/:id` | Delete application (verified user owns it) |

### Other
- `GET /api/stats` — dashboard stats (resumeCount, jobsByStatus, creditsUsed, creditsLimit, isPro)
- `GET /api/resumes`, `POST`, `PUT`, `DELETE` — saved resume CRUD
- `POST /api/stripe/create-checkout-session`, `POST /api/stripe/create-portal-session`
- `POST /api/stripe/webhook` — verifies Stripe signature, handles `checkout.session.completed`
- `GET /api/health`

## Database Schema

### `users`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| email | text unique | |
| passwordHash | text nullable | null for Google-only accounts |
| googleId | text unique nullable | set on Google sign-in |
| name | text nullable | |
| phone | text nullable | |
| plan | text | `starter` \| `pro` \| `lifetime` |
| lifetimeAccess | boolean | true = unlimited AI |
| stripeCustomerId | text nullable | |
| stripeSubscriptionId | text nullable | |
| aiCreditsUsed | integer | resets monthly |
| aiCreditsResetAt | timestamp | next reset date |
| createdAt | timestamp | |

### `resumes`
`id`, `userId` (FK), `name`, `content` (JSONB), `createdAt`, `updatedAt`

### `jobApplications`
| Column | Notes |
|---|---|
| id | uuid PK |
| userId | FK → users |
| company, jobTitle | required |
| jobUrl | optional |
| status | `saved` \| `applied` \| `phone_screen` \| `interview` \| `offer` \| `rejected` \| `withdrawn` |
| notes | optional |
| salary | integer (annual, optional) |
| contactName, contactEmail | optional |
| followUpDate | date (optional) |
| appliedAt | timestamp (optional) |
| createdAt, updatedAt | |

### `user_sessions`
Managed by `connect-pg-simple` (`createTableIfMissing: true`).

## Architecture Decisions

**OpenRouter instead of OpenAI** — all AI calls go through `https://openrouter.ai/api/v1` using the existing `openai` npm package with a `baseURL` override and `HTTP-Referer`/`X-Title` headers. Model is configurable via `OPENROUTER_MODEL` env var. This decouples model choice from deployment and gives access to non-OpenAI models (Claude, Gemini, Mistral, etc.) with a single API key.

**SSE streaming** — `POST /ai/tailor` and `POST /ai/cover-letter` stream tokens over Server-Sent Events. The server cancels the upstream OpenRouter request via `AbortController` when the client disconnects (`res.on("close")`), stopping token consumption immediately.

**Three-tier rate limiting** — `authLimiter` (10/15 min, skips successes) on `/api/auth`; `aiLimiter` (10/min per IP) on `/api/ai`; `generalLimiter` (300/15 min) on all `/api`; plus `aiHelperLimiter` (100/day, keyed on `userId` or IP) on the free AI helper endpoints. The general limiter runs last (highest priority routes declared first in `app.ts`).

**AI credit metering** — two-layer gate: `creditPolicy.ts` (pure, unit-testable) checks plan + credits; `aiCredits.ts` atomically increments usage in DB. Only `tailor` and `cover-letter` consume credits. ATS, resume score, summary, bullets, interview prep, skills gap, and LinkedIn import are always free.

**Template system** — 5 layout components (SingleColumn, SidebarLeft, SidebarRight, Banner, Compact) × 5 color themes (Classic, Ocean, Forest, Sunset, Slate) = 25 templates. Templates use inline styles only (no Tailwind) so they survive the print popup without CSS purging. PDF export: `ReactDOMServer.renderToStaticMarkup` → full HTML doc → `window.open()` with Print/Close buttons.

**Google OAuth2** — raw OAuth2 without Passport.js. State parameter is a 16-byte random hex string stored in the session. The callback validates state then immediately deletes `req.session.oauthState` (prevents replay). Users with existing email accounts get their `googleId` linked automatically on first Google sign-in.

**LinkedIn import** — no LinkedIn API needed. User copies their profile page text; the app posts it (truncated to 4 000 chars to prevent prompt injection) to `/api/ai/import-linkedin`, which uses AI to parse it into resume JSON.

**VPS deployment** — Docker Compose runs the API container (bound to `127.0.0.1:5000`) and a Postgres container. Nginx on the host machine proxies `/api/` to the container and serves the Vite-built static files from `/var/www/career-craft`. `proxy_buffering off` on the `/api/ai` location is required for SSE to flush through nginx. See `DEPLOY.md` for full steps.

**GDPR** — `GET /auth/export-data` returns an attachment JSON containing the user's full profile, all resumes, and all job applications. `DELETE /auth/account` deletes all related rows in dependency order before deleting the user row. Both endpoints require an active session.

## Product Pages

| Route | Page | Auth |
|---|---|---|
| `/` | Dashboard (logged-in) or Marketing (logged-out) | Optional |
| `/login` | Email/password + Google sign-in | — |
| `/builder` | Resume editor with AI helpers + template preview + PDF export | Required |
| `/my-resumes` | Saved resumes list | Required |
| `/tailor` | AI resume tailoring (paste resume + JD → rewrite) | Required |
| `/cover-letter` | Cover letter generator with tone selector | Required |
| `/ats-score` | ATS keyword scoring + Skills Gap tab | Required |
| `/job-tracker` | Kanban board (7 columns) with pipeline stats | Required |
| `/interview-prep` | AI interview question generator by category | Required |
| `/profile` | Account info, plan/usage, data export, account deletion | Required |

## Plans

| Plan | Price | AI Generations | Resumes | Job Apps |
|---|---|---|---|---|
| Starter | Free | 5/month (tailor + cover letter) | 1 | 10 |
| Pro | $20/month | Unlimited | Unlimited | Unlimited |
| Lifetime | $149.99 once | Unlimited | Unlimited | Unlimited |

Free AI helpers (ATS score, summary, bullets, interview prep, skills gap, LinkedIn import) are unlimited for all plans.

## Owner Account

`tlc01301@gmail.com` is granted `plan: "lifetime"` and `lifetimeAccess: true` automatically on register and login — no Stripe purchase required. Enforced in `artifacts/api-server/src/routes/auth.ts`.

## Gotchas

- Run `pnpm --filter @workspace/db run push` after schema changes. New columns added in this version: `users.googleId`, `jobApplications.salary`, `jobApplications.contactName`, `jobApplications.contactEmail`, `jobApplications.followUpDate`.
- The Stripe webhook route (`/api/stripe/webhook`) receives `express.raw` before `express.json()` — don't reorder these in `app.ts`. It is also exempt from `generalLimiter`.
- `app.set("trust proxy", 1)` must remain — rate limiting uses client IP and the VPS sits behind nginx.
- SSE endpoints require `proxy_buffering off` in nginx; see `nginx/craft.hiddentechdaily.com.conf`.
- Google login requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. If not set, `GET /api/auth/google` returns 501. The callback redirect URI registered in Google Cloud Console must exactly match `APP_URL + /api/auth/google/callback`.
- `sameSite: "strict"` on the session cookie in production means the cookie is not sent on cross-site navigations — this is correct for a same-origin setup (nginx serves both the SPA and proxies `/api`).
