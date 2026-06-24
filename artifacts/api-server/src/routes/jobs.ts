import { Router } from "express";
import { db, users, jobApplications, insertJobApplicationSchema, updateJobApplicationSchema } from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

const STARTER_JOB_LIMIT = 10;

router.get("/jobs", requireAuth, async (req, res) => {
  try {
    const applications = await db
      .select()
      .from(jobApplications)
      .where(eq(jobApplications.userId, req.session.userId!))
      .orderBy(desc(jobApplications.createdAt));

    res.json(applications);
  } catch (err) {
    req.log.error({ err }, "List job applications error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/jobs", requireAuth, async (req, res) => {
  const parsed = insertJobApplicationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.session.userId!))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const isPro = user.plan === "pro" || user.plan === "lifetime" || user.lifetimeAccess;

    if (!isPro) {
      const [{ total }] = await db
        .select({ total: count() })
        .from(jobApplications)
        .where(eq(jobApplications.userId, user.id));

      if (Number(total) >= STARTER_JOB_LIMIT) {
        res.status(403).json({
          error: "Job tracking limit reached",
          message: "Upgrade to Pro for unlimited job tracking.",
          limitReached: true,
        });
        return;
      }
    }

    const [application] = await db
      .insert(jobApplications)
      .values({
        userId: user.id,
        company: parsed.data.company,
        jobTitle: parsed.data.jobTitle,
        jobUrl: parsed.data.jobUrl ?? null,
        status: parsed.data.status ?? "saved",
        notes: parsed.data.notes ?? null,
        appliedAt: parsed.data.appliedAt ?? null,
      })
      .returning();

    res.status(201).json(application);
  } catch (err) {
    req.log.error({ err }, "Create job application error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/jobs/:id", requireAuth, async (req, res) => {
  const parsed = updateJobApplicationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(jobApplications)
      .where(and(eq(jobApplications.id, req.params.id), eq(jobApplications.userId, req.session.userId!)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Job application not found" });
      return;
    }

    const [updated] = await db
      .update(jobApplications)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(eq(jobApplications.id, req.params.id))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update job application error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/jobs/:id", requireAuth, async (req, res) => {
  try {
    const [existing] = await db
      .select()
      .from(jobApplications)
      .where(and(eq(jobApplications.id, req.params.id), eq(jobApplications.userId, req.session.userId!)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Job application not found" });
      return;
    }

    await db.delete(jobApplications).where(eq(jobApplications.id, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Delete job application error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
