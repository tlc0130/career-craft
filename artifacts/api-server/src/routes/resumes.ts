import { Router } from "express";
import { db, users, resumes, saveResumeSchema } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

const STARTER_RESUME_LIMIT = 1;

router.get("/resumes", requireAuth, async (req, res) => {
  try {
    const userResumes = await db
      .select()
      .from(resumes)
      .where(eq(resumes.userId, req.session.userId!))
      .orderBy(resumes.updatedAt);

    res.json(userResumes.reverse());
  } catch (err) {
    req.log.error({ err }, "List resumes error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/resumes/:id", requireAuth, async (req, res) => {
  try {
    const [resume] = await db
      .select()
      .from(resumes)
      .where(eq(resumes.id, req.params.id))
      .limit(1);

    if (!resume || resume.userId !== req.session.userId!) {
      res.status(404).json({ error: "Resume not found" });
      return;
    }

    res.json(resume);
  } catch (err) {
    req.log.error({ err }, "Get resume error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/resumes", requireAuth, async (req, res) => {
  const parsed = saveResumeSchema.safeParse(req.body);
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

    const isPro = user.plan === "pro" || user.lifetimeAccess;

    if (!isPro) {
      const [{ total }] = await db
        .select({ total: count() })
        .from(resumes)
        .where(eq(resumes.userId, user.id));

      if (Number(total) >= STARTER_RESUME_LIMIT) {
        res.status(403).json({
          error: "Resume limit reached",
          message: `Starter plan allows saving ${STARTER_RESUME_LIMIT} resume. Upgrade to Pro for unlimited saves.`,
          limitReached: true,
        });
        return;
      }
    }

    const [resume] = await db
      .insert(resumes)
      .values({
        userId: user.id,
        title: parsed.data.title,
        jobTitle: parsed.data.jobTitle ?? null,
        content: parsed.data.content,
      })
      .returning();

    res.status(201).json(resume);
  } catch (err) {
    req.log.error({ err }, "Save resume error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/resumes/:id", requireAuth, async (req, res) => {
  const parsed = saveResumeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(resumes)
      .where(eq(resumes.id, req.params.id))
      .limit(1);

    if (!existing || existing.userId !== req.session.userId!) {
      res.status(404).json({ error: "Resume not found" });
      return;
    }

    const [updated] = await db
      .update(resumes)
      .set({
        title: parsed.data.title,
        jobTitle: parsed.data.jobTitle ?? null,
        content: parsed.data.content,
        updatedAt: new Date(),
      })
      .where(eq(resumes.id, req.params.id))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update resume error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/resumes/:id", requireAuth, async (req, res) => {
  try {
    const [existing] = await db
      .select()
      .from(resumes)
      .where(eq(resumes.id, req.params.id))
      .limit(1);

    if (!existing || existing.userId !== req.session.userId!) {
      res.status(404).json({ error: "Resume not found" });
      return;
    }

    await db.delete(resumes).where(eq(resumes.id, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Delete resume error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
