/**
 * Pure, dependency-free AI-credit policy. Kept separate from aiCredits.ts (which
 * touches the database) so it can be unit-tested without a DB connection.
 */

export const STARTER_MONTHLY_AI_LIMIT = Number(
  process.env["STARTER_MONTHLY_AI_LIMIT"] ?? 5,
);

export const CREDIT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export interface CreditState {
  plan: string;
  lifetimeAccess: boolean;
  aiCreditsUsed: number;
  aiCreditsResetAt: Date | string | number;
}

export type CreditDecision =
  | { allowed: true; unlimited: true }
  | { allowed: true; unlimited: false; windowReset: boolean; resetAt: number }
  | { allowed: false; reason: string };

function limitReachedMessage(limit: number): string {
  return `You've used all ${limit} free AI generations for this period. Upgrade to Pro for unlimited resume tailoring and cover letters.`;
}

export function creditLimitMessage(limit: number = STARTER_MONTHLY_AI_LIMIT): string {
  return limitReachedMessage(limit);
}

/**
 * Given a user's current credit state and the clock, decide whether one more
 * generation is permitted. No I/O.
 */
export function decideCredit(
  state: CreditState,
  now: number,
  limit: number = STARTER_MONTHLY_AI_LIMIT,
): CreditDecision {
  const isPro =
    state.plan === "pro" || state.plan === "lifetime" || state.lifetimeAccess;
  if (isPro) return { allowed: true, unlimited: true };

  const resetAt = new Date(state.aiCreditsResetAt).getTime();
  const windowExpired = !resetAt || Number.isNaN(resetAt) || now >= resetAt;
  const used = windowExpired ? 0 : state.aiCreditsUsed;

  if (used >= limit) {
    return { allowed: false, reason: limitReachedMessage(limit) };
  }

  return {
    allowed: true,
    unlimited: false,
    windowReset: windowExpired,
    resetAt: windowExpired ? now + CREDIT_WINDOW_MS : resetAt,
  };
}
