import { db, users } from "@workspace/db";
import { and, eq, lt, sql } from "drizzle-orm";
import {
  STARTER_MONTHLY_AI_LIMIT,
  CREDIT_WINDOW_MS,
  creditLimitMessage,
  decideCredit,
} from "./creditPolicy";

export { STARTER_MONTHLY_AI_LIMIT, decideCredit } from "./creditPolicy";

export type ConsumeResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

/**
 * Atomically charge one AI credit to a user, rolling the monthly window if it
 * has elapsed. Returns a 429 result when the free-tier limit is exhausted.
 */
export async function consumeAiCredit(userId: string): Promise<ConsumeResult> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return { ok: false, status: 401, message: "Not authenticated" };

  const now = Date.now();
  const decision = decideCredit(
    {
      plan: user.plan,
      lifetimeAccess: user.lifetimeAccess,
      aiCreditsUsed: user.aiCreditsUsed,
      aiCreditsResetAt: user.aiCreditsResetAt,
    },
    now,
  );

  if (!decision.allowed) {
    return { ok: false, status: 429, message: decision.reason };
  }
  if (decision.unlimited) return { ok: true };

  // Roll the window first if it has expired, then charge atomically. The
  // conditional `used < limit` guard keeps a race from overspending.
  if (decision.windowReset) {
    await db
      .update(users)
      .set({ aiCreditsUsed: 0, aiCreditsResetAt: new Date(decision.resetAt) })
      .where(eq(users.id, user.id));
  }

  const charged = await db
    .update(users)
    .set({ aiCreditsUsed: sql`${users.aiCreditsUsed} + 1` })
    .where(and(eq(users.id, user.id), lt(users.aiCreditsUsed, STARTER_MONTHLY_AI_LIMIT)))
    .returning({ used: users.aiCreditsUsed });

  if (charged.length === 0) {
    return { ok: false, status: 429, message: creditLimitMessage() };
  }

  return { ok: true };
}

/** Read-only usage summary for surfacing remaining credits in the UI. */
export async function getUsage(userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return null;

  const isPro =
    user.plan === "pro" || user.plan === "lifetime" || user.lifetimeAccess;
  if (isPro) {
    return { unlimited: true as const, plan: user.plan };
  }

  const now = Date.now();
  const resetAt = new Date(user.aiCreditsResetAt).getTime();
  const windowExpired = !resetAt || Number.isNaN(resetAt) || now >= resetAt;
  const used = windowExpired ? 0 : user.aiCreditsUsed;

  return {
    unlimited: false as const,
    plan: user.plan,
    limit: STARTER_MONTHLY_AI_LIMIT,
    used,
    remaining: Math.max(0, STARTER_MONTHLY_AI_LIMIT - used),
    resetAt: windowExpired ? now + CREDIT_WINDOW_MS : resetAt,
  };
}
