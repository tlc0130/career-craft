# Career Craft

AI-powered resume tailoring: a user pastes or uploads a resume plus a job description, and the app rewrites the resume (and can draft a matching cover letter) to align with that specific posting. Delivered as a web app, a mobile app, and a shared API, with Stripe-based plans.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, serves `/api/*`)
- `pnpm --filter @workspace/resume-builder run dev` — run the web app (Vite, port 20047)
- `pnpm --filter @workspace/career-craft-mobile run dev` — run the Expo mobile app
- `pnpm --filter @workspace/api-server test` — run API unit tests (vitest)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter scripts run ...` — Stripe product seeding (`seed-products`)
- Required env: `DATABASE_URL`, `SESSION_SECRET`, `OPENAI_API_KEY`, `REPLIT_DOMAINS`,
  `STRIPE_PRO_PRICE_ID`, `STRIPE_LIFETIME_PRICE_ID` (+ Stripe secret/webhook secret via the Replit Stripe integration).
- Optional env: `STARTER_MONTHLY_AI_LIMIT` (free-tier AI generations per 30-day window; default 3).

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5, sessions in Postgres (`connect-pg-simple`), bcrypt auth, pino logging, `express-rate-limit`
- Web: React 19 + Vite + Tailwind v4 + wouter + TanStack Query
- Mobile: Expo (expo-router), React Native 0.81
- DB: PostgreSQL + Drizzle ORM
- AI: OpenAI `gpt-4o-mini`, streamed to clients over Server-Sent Events
- Payments: Stripe (Pro subscription + one-time Lifetime)
- API codegen: Orval (from OpenAPI spec); validation with Zod + drizzle-zod
- Build: esbuild (API → CJS/MJS bundle)

## Where things live

- DB schema (source of truth): `lib/db/src/schema/schema.ts`
- API routes: `artifacts/api-server/src/routes/` (`auth`, `resumes`, `ai`, `stripe`, `health`)
- Shared API middleware: `artifacts/api-server/src/middlewares/` (`auth`, `rateLimit`)
- AI metering policy: `artifacts/api-server/src/lib/creditPolicy.ts` (pure) + `aiCredits.ts` (DB)
- Web pages: `artifacts/resume-builder/src/pages/` (`Tailor`, `CoverLetter`, `Builder`, `MyResumes`, `Home`, `Login`)
- Web auth/billing client: `artifacts/resume-builder/src/lib/auth.tsx`
- Doc export (DOCX/PDF, client-side): `artifacts/resume-builder/src/lib/docx-export.ts`
- Mobile screens: `artifacts/career-craft-mobile/app/(tabs)/`; auth/session: `context/AuthContext.tsx`
- API contract: `lib/api-spec/openapi.yaml` → generates `lib/api-zod` and `lib/api-client-react`

## Architecture decisions

- One Express API serves both the web SPA and the mobile app. Replit's application router stitches the static web build (`/`) and the API (`/api`) onto a single domain, so the web client uses relative `/api/...` fetches with cookie sessions.
- Mobile can't rely on the browser cookie jar, so it captures the session cookie on login and replays it as a `Cookie` header; the cookie is stored in `expo-secure-store` on native (AsyncStorage fallback on web).
- AI generation is gated two ways: `requireAuth` on every `/api/ai/*` route, plus a per-plan monthly credit (`consumeAiCredit`). Starter is limited; Pro/Lifetime are unlimited. This protects the OpenAI key and ties the paid plans to real value.
- AI responses stream as SSE; the server aborts the upstream OpenAI request when the client disconnects (`res.on("close")`) so cancelled generations stop billing tokens.
- The credit policy is split into a pure module (`creditPolicy.ts`, unit-tested) and a DB-backed consumer (`aiCredits.ts`) so the policy can be tested without a database.

## Product

- **Tailor Resume** — paste/upload (PDF/DOCX) a resume + job description → streamed, ATS-oriented rewrite; export DOCX/PDF.
- **Cover Letter** — generate a tailored cover letter from the same inputs.
- **My Resumes** — save tailored resumes to the account (Starter: 1; Pro/Lifetime: unlimited).
- **Plans** — Starter (free, metered AI), Pro ($20/mo subscription), Lifetime ($149.99 one-time), managed via Stripe Checkout + billing portal.

## Gotchas

- Run `pnpm --filter @workspace/db run push` after editing the schema. The AI-credit columns (`ai_credits_used`, `ai_credits_reset_at`) must exist before the AI routes will work.
- The Stripe webhook needs the raw request body — it is mounted (`express.raw`) before `express.json()` in `app.ts`, and it is exempt from the general rate limiter. Don't reorder those.
- `app.set("trust proxy", 1)` is required for correct client IPs behind Replit's proxy (rate limiting depends on it).
- AI endpoints now require a logged-in session; the web Tailor/Cover Letter pages redirect anonymous visitors to `/login`.

## User preferences

- The owner account (`tlc01301@gmail.com`) is granted lifetime access automatically on register/login (`routes/auth.ts`).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
