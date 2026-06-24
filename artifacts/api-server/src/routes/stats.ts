import { Router } from "express";
import { db, resumes, jobApplications, users } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

const STARTER_MONTHLY_AI_LIMIT = Number(process.env["STARTER_MONTHLY_AI_LIMIT"] ?? 5);

const ALL_STATUSES = [
  "saved",
  "applied",
  "phone_screen",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
] as const;

router.get("/stats", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    // Resume count
    const [resumeRow] = await db
      .select({ total: count() })
      .from(resumes)
      .where(eq(resumes.userId, userId));
    const resumeCount = Number(resumeRow?.total ?? 0);

    // Jobs by status
    const jobRows = await db
      .select({ status: jobApplications.status, total: count() })
      .from(jobApplications)
      .where(eq(jobApplications.userId, userId))
      .groupBy(jobApplications.status);

    const statusMap = Object.fromEntries(jobRows.map((r) => [r.status, Number(r.total)]));
    const jobsByStatus: Record<string, number> = {};
    let totalJobs = 0;
    for (const s of ALL_STATUSES) {
      const n = statusMap[s] ?? 0;
      jobsByStatus[s] = n;
      totalJobs += n;
    }

    // Credits
    const isPro = user.plan === "pro" || user.plan === "lifetime" || user.lifetimeAccess;

    const now = Date.now();
    const resetAt = user.aiCreditsResetAt ? new Date(user.aiCreditsResetAt).getTime() : null;
    const windowExpired = resetAt === null || Number.isNaN(resetAt) || now >= resetAt;
    const creditsUsed = windowExpired ? 0 : user.aiCreditsUsed;
    const creditsLimit = isPro ? null : STARTER_MONTHLY_AI_LIMIT;

    res.json({
      resumeCount,
      jobsByStatus,
      totalJobs,
      creditsUsed,
      creditsLimit,
      isPro,
    });
  } catch (err) {
    req.log.error({ err }, "Stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
