import rateLimit from "express-rate-limit";
import type { Request } from "express";

const FIFTEEN_MIN = 15 * 60 * 1000;

/** Broad backstop for the whole API surface (Stripe webhooks exempted). */
export const generalLimiter = rateLimit({
  windowMs: FIFTEEN_MIN,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) => req.originalUrl.startsWith("/api/stripe/webhook"),
  message: { error: "Too many requests. Please slow down and try again shortly." },
});

/** Tight limit on auth endpoints to blunt credential brute-force. */
export const authLimiter = rateLimit({
  windowMs: FIFTEEN_MIN,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Too many attempts. Please wait a few minutes and try again." },
});

/**
 * Burst limit on the (expensive) AI endpoints. The per-plan credit system is
 * the real quota; this just caps abusive bursts on top of it.
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "You're generating too quickly. Please wait a moment and try again." },
});

/**
 * Per-user daily cap on free AI helper endpoints (generate-summary, generate-bullets,
 * interview-prep, skills-gap, import-linkedin). These don't consume the monthly credit
 * quota, so we enforce a generous daily ceiling keyed on userId (or IP for anonymous).
 */
export const aiHelperLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const userId = (req.session as { userId?: string })?.userId;
    return userId ?? req.ip ?? "unknown";
  },
  message: { error: "Daily limit reached for AI helpers. Resets at midnight UTC." },
});
