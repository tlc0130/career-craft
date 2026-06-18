# Career Craft

> AI-powered resume tailoring across web, mobile, and a shared API.

Career Craft takes a candidate's resume plus a specific job description and rewrites the resume — and, optionally, drafts a matching cover letter — so it aligns with that exact posting. It ships as a **React web app**, an **Expo mobile app**, and a **shared Express API**, with **Stripe-based plans** and **per-plan AI metering**.

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Running the apps](#running-the-apps)
- [API overview](#api-overview)
- [Plans & billing](#plans--billing)
- [Database](#database)
- [Testing & type-checking](#testing--type-checking)
- [Design decisions](#design-decisions)
- [Gotchas](#gotchas)
- [License](#license)

---

## Features

- **Tailor Resume** — Paste or upload a resume (PDF/DOCX) plus a job description and get a streamed, ATS-oriented rewrite. Export the result as DOCX or PDF (client-side).
- **Cover Letter** — Generate a tailored cover letter from the same inputs.
- **My Resumes** — Save tailored resumes to your account (Starter: 1 saved; Pro/Lifetime: unlimited).
- **Plans & billing** — Starter (free, metered AI), Pro (monthly subscription), and Lifetime (one-time), managed through Stripe Checkout and the Stripe billing portal.
- **Streaming AI** — Generations stream to the client over Server-Sent Events (SSE); cancelling a generation aborts the upstream OpenAI request so cancelled work stops billing tokens.
- **Auth + metering** — Every AI route requires a logged-in session and consumes a per-plan monthly AI credit, protecting the OpenAI key and tying paid plans to real value.

## Architecture

One Express API serves both the web SPA and the mobile app:

```
                ┌─────────────────────────────┐
   Web (Vite) ──┤                             │
                │   Express 5 API (/api/*)    ├── OpenAI (gpt-4o-mini, SSE)
 Mobile (Expo) ─┤   sessions in Postgres      ├── Stripe (Checkout + webhooks)
                │   bcrypt auth · rate limit  ├── PostgreSQL (Drizzle ORM)
                └─────────────────────────────┘
```

- The web client uses relative `/api/...` fetches with cookie sessions. On Replit, the application router stitches the static web build (`/`) and the API (`/api`) onto a single domain.
- Mobile cannot rely on a browser cookie jar, so it captures the session cookie on login and replays it as a `Cookie` header. The cookie is stored in `expo-secure-store` on native (with an AsyncStorage fallback on web).
- The API contract lives in `lib/api-spec/openapi.yaml` and generates the Zod validators (`lib/api-zod`) and the React Query client (`lib/api-client-react`) via Orval.

## Tech stack

| Layer       | Technology |
|-------------|------------|
| Monorepo    | pnpm workspaces, Node.js 24, TypeScript 5.9 |
| API         | Express 5, `connect-pg-simple` sessions, bcrypt auth, pino logging, `express-rate-limit`, esbuild bundle |
| Web         | React 19, Vite, Tailwind CSS v4, wouter, TanStack Query |
| Mobile      | Expo (expo-router), React Native 0.81 |
| Database    | PostgreSQL + Drizzle ORM |
| AI          | OpenAI `gpt-4o-mini`, streamed over SSE |
| Payments    | Stripe (Pro subscription + one-time Lifetime) |
| Validation  | Zod + drizzle-zod |
| API codegen | Orval (from the OpenAPI spec) |

## Repository layout

This is a pnpm workspace. Packages live under `artifacts/*`, `lib/*`, and `scripts`.

```
career-craft/
├── artifacts/
│   ├── api-server/          @workspace/api-server — Express API (port 8080)
│   │   └── src/
│   │       ├── routes/      auth · resumes · ai · stripe · health
│   │       ├── middlewares/ auth · rateLimit
│   │       └── lib/         creditPolicy.ts (pure) · aiCredits.ts (DB)
│   ├── resume-builder/      @workspace/resume-builder — React web app (Vite, port 20047)
│   │   └── src/
│   │       ├── pages/       Tailor · CoverLetter · Builder · MyResumes · Home · Login
│   │       └── lib/         auth.tsx · docx-export.ts (client-side DOCX/PDF)
│   ├── career-craft-mobile/ @workspace/career-craft-mobile — Expo mobile app
│   │   └── app/             (auth) · (tabs) · history-detail
│   └── mockup-sandbox/      @workspace/mockup-sandbox — UI prototyping sandbox
├── lib/
│   ├── db/                  @workspace/db — Drizzle schema (source of truth)
│   ├── api-spec/            @workspace/api-spec — OpenAPI contract
│   ├── api-zod/             @workspace/api-zod — generated Zod validators
│   └── api-client-react/    @workspace/api-client-react — generated React Query client
└── scripts/                 @workspace/scripts — Stripe product seeding, post-merge hook
```

## Getting started

### Prerequisites

- **Node.js 24**
- **pnpm** (the workspace enforces pnpm; `npm`/`yarn` are blocked by a `preinstall` guard)
- A **PostgreSQL** database
- An **OpenAI API key** and a **Stripe account**

### Install

```bash
pnpm install
```

> **Supply-chain note:** the workspace sets `minimumReleaseAge: 1440` (1 day) in `pnpm-workspace.yaml`, so newly published package versions cannot be installed until they have been public for 24 hours. Do not disable this. See the comments in `pnpm-workspace.yaml` for the rationale and allowlist.

### Set up the database

```bash
pnpm --filter @workspace/db run push   # push the Drizzle schema (dev only)
```

## Environment variables

Set the following before running the API:

**Required**

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Secret used to sign session cookies |
| `OPENAI_API_KEY` | OpenAI API key for resume/cover-letter generation |
| `REPLIT_DOMAINS` | Allowed domain(s) for the deployed app |
| `STRIPE_PRO_PRICE_ID` | Stripe price ID for the Pro subscription |
| `STRIPE_LIFETIME_PRICE_ID` | Stripe price ID for the one-time Lifetime plan |

Stripe's secret key and webhook secret are provided via the Replit Stripe integration.

**Optional**

| Variable | Default | Purpose |
|----------|---------|---------|
| `STARTER_MONTHLY_AI_LIMIT` | `3` | Free-tier AI generations per 30-day window |

## Running the apps

```bash
# API server (port 8080, serves /api/*)
pnpm --filter @workspace/api-server run dev

# Web app (Vite, port 20047)
pnpm --filter @workspace/resume-builder run dev

# Mobile app (Expo)
pnpm --filter @workspace/career-craft-mobile run dev
```

Seed Stripe products:

```bash
pnpm --filter @workspace/scripts run seed-products
```

## API overview

All routes are mounted under `/api`. AI routes require an authenticated session **and** consume an AI credit.

**Auth**
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET  /api/auth/me`

**Resumes** (auth required)
- `GET    /api/resumes`
- `GET    /api/resumes/:id`
- `POST   /api/resumes`
- `PUT    /api/resumes/:id`
- `DELETE /api/resumes/:id`

**AI** (auth + credit required)
- `POST /api/ai/tailor` — streamed resume rewrite (accepts an uploaded file)
- `POST /api/ai/cover-letter` — streamed cover letter (accepts an uploaded file)
- `POST /api/ai/extract-job-context` — pull structured context from a job description
- `GET  /api/ai/usage` — current AI credit usage

**Stripe** (auth required, except the webhook)
- `POST /api/stripe/create-checkout`
- `POST /api/stripe/webhook` — Stripe webhook (raw body)
- `GET  /api/stripe/portal` — billing portal link
- `GET  /api/stripe/subscription` — subscription status

**Health**
- `GET /api/healthz`

## Plans & billing

| Plan | Price | AI generations | Saved resumes |
|------|-------|----------------|---------------|
| **Starter** | Free | Metered (`STARTER_MONTHLY_AI_LIMIT`, default 3 / 30 days) | 1 |
| **Pro** | Monthly subscription | Unlimited | Unlimited |
| **Lifetime** | One-time | Unlimited | Unlimited |

AI metering is split into a pure, unit-tested policy module (`creditPolicy.ts`) and a DB-backed consumer (`aiCredits.ts`), so the policy can be tested without a database.

## Database

- The schema source of truth is `lib/db/src/schema/schema.ts` (tables: `users`, `resumes`).
- After editing the schema, run `pnpm --filter @workspace/db run push`.
- The AI-credit columns (`ai_credits_used`, `ai_credits_reset_at`) must exist before the AI routes will work.

## Testing & type-checking

```bash
pnpm --filter @workspace/api-server test   # API unit tests (vitest)
pnpm run typecheck                          # full typecheck across all packages
pnpm run build                              # typecheck + build all packages
```

## Design decisions

- **Single API for web + mobile.** One Express server backs both clients; the web SPA and API are served from one domain so the browser can use cookie sessions with relative fetches.
- **Cookie replay on mobile.** Native clients capture and replay the session cookie since they have no browser cookie jar.
- **Two-layer AI gating.** `requireAuth` guards every `/api/ai/*` route, and `consumeAiCredit` enforces per-plan monthly limits — protecting the OpenAI key and tying paid plans to real value.
- **Cancellable streaming.** AI responses stream as SSE; the server aborts the upstream OpenAI request on client disconnect (`res.on("close")`) so cancelled generations stop billing tokens.
- **Pure, testable credit policy.** The metering logic is separated from its database access for easy unit testing.

## Gotchas

- **Run `db push` after schema edits.** The AI-credit columns must exist before the AI routes will work.
- **Stripe webhook ordering.** The webhook needs the raw request body — it is mounted with `express.raw` **before** `express.json()` in `app.ts`, and is exempt from the general rate limiter. Don't reorder those.
- **Trust proxy.** `app.set("trust proxy", 1)` is required for correct client IPs behind the proxy; rate limiting depends on it.
- **Auth-gated AI.** AI endpoints require a logged-in session; the web Tailor and Cover Letter pages redirect anonymous visitors to `/login`.

## License

MIT
