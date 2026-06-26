import { Router } from "express";
import { db, tailoredResumes, saveTailoredResumeSchema } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// List the current user's tailored resumes (most recent first).
router.get("/tailored-resumes", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(tailoredResumes)
      .where(eq(tailoredResumes.userId, req.session.userId!))
      .orderBy(desc(tailoredResumes.createdAt))
      .limit(100);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "List tailored resumes error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/tailored-resumes/:id", requireAuth, async (req, res) => {
  try {
    const [row] = await db
      .select()
      .from(tailoredResumes)
      .where(eq(tailoredResumes.id, req.params.id))
      .limit(1);

    if (!row || row.userId !== req.session.userId!) {
      res.status(404).json({ error: "Tailored resume not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Get tailored resume error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tailored-resumes", requireAuth, async (req, res) => {
  const parsed = saveTailoredResumeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  try {
    const [row] = await db
      .insert(tailoredResumes)
      .values({
        userId: req.session.userId!,
        title: parsed.data.title,
        company: parsed.data.company ?? null,
        jobTitle: parsed.data.jobTitle ?? null,
        originalText: parsed.data.originalText,
        tailoredText: parsed.data.tailoredText,
        jobDescription: parsed.data.jobDescription,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Save tailored resume error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/tailored-resumes/:id", requireAuth, async (req, res) => {
  try {
    const [existing] = await db
      .select()
      .from(tailoredResumes)
      .where(eq(tailoredResumes.id, req.params.id))
      .limit(1);

    if (!existing || existing.userId !== req.session.userId!) {
      res.status(404).json({ error: "Tailored resume not found" });
      return;
    }

    await db.delete(tailoredResumes).where(eq(tailoredResumes.id, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Delete tailored resume error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
