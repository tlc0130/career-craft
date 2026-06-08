import { Router } from "express";
import OpenAI from "openai";
import multer from "multer";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import mammoth from "mammoth";
import { requireAuth } from "../middlewares/auth";
import { consumeAiCredit, getUsage } from "../lib/aiCredits";

const router = Router();

// Every AI endpoint requires an authenticated session. This is the fix for
// the previously open, unmetered OpenAI proxy.
router.use(requireAuth);

// Lazily instantiated so the server can start (and serve health/auth routes)
// even if OPENAI_API_KEY isn't set in the environment. The first AI request
// will surface a clear error rather than crashing the process on boot.
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) {
      throw Object.assign(new Error("OPENAI_API_KEY environment variable is not set."), { status: 503 });
    }
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

async function extractTextFromFile(buffer: Buffer, mimeType: string, originalName: string): Promise<string> {
  const name = originalName.toLowerCase();

  if (mimeType === "application/pdf" || name.endsWith(".pdf")) {
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword" ||
    name.endsWith(".docx") ||
    name.endsWith(".doc")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  return buffer.toString("utf-8");
}

router.post("/ai/tailor", upload.single("resume"), async (req, res) => {
  try {
    let resumeText: string;

    if (req.file) {
      resumeText = await extractTextFromFile(req.file.buffer, req.file.mimetype, req.file.originalname);
      if (resumeText.trim().length < 50) {
        res.status(422).json({
          error:
            "We couldn't read text from this file. It may be a scanned image or corrupted. Try a text-based PDF or paste your resume instead.",
        });
        return;
      }
    } else {
      resumeText = (req.body as { resumeText?: string }).resumeText ?? "";
    }

    const jobDescription = (req.body as { jobDescription?: string }).jobDescription ?? "";

    if (!resumeText || !jobDescription) {
      res.status(400).json({ error: "resumeText and jobDescription are required" });
      return;
    }

    const credit = await consumeAiCredit(req.session.userId!);
    if (!credit.ok) {
      res.status(credit.status).json({ error: credit.message, limitReached: credit.status === 429 });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Cancel the upstream OpenAI request if the client disconnects, so we stop
    // paying for tokens the user will never see.
    const controller = new AbortController();
    res.on("close", () => controller.abort());

    const stream = await getOpenAI().chat.completions.create(
      {
        model: "gpt-4o-mini",
        max_tokens: 4096,
        stream: true,
        messages: [
          {
            role: "system",
            content: `You are an expert resume writer and career coach. Your job is to tailor a user's resume to match a specific job description.

Rewrite the resume to:
1. Highlight experience and skills that match the job requirements
2. Use keywords from the job description naturally
3. Reorder or emphasize bullet points to best match the role
4. Keep all factual information accurate — never invent experience
5. Maintain a professional, concise tone

Return ONLY the tailored resume text, formatted cleanly with clear section headers (e.g. SUMMARY, EXPERIENCE, EDUCATION, SKILLS). Do not include any commentary, preamble, or explanation.`,
          },
          {
            role: "user",
            content: `Here is my current resume:\n\n${resumeText}\n\n---\n\nHere is the job description I'm applying to:\n\n${jobDescription}\n\n---\n\nPlease tailor my resume for this specific role.`,
          },
        ],
      },
      { signal: controller.signal },
    );

    for await (const chunk of stream) {
      if (controller.signal.aborted || res.writableEnded) break;
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    }
  } catch (err: any) {
    // Client disconnected / stream aborted — nothing left to send.
    if (res.writableEnded || err?.name === "AbortError" || err?.name === "APIUserAbortError") return;
    req.log.error({ err }, "AI tailor error");
    const userMessage =
      err?.status === 429
        ? "OpenAI quota exceeded. Please check your API key's billing plan at platform.openai.com."
        : err?.status === 401
        ? "Invalid OpenAI API key. Please check your OPENAI_API_KEY secret."
        : "AI processing failed. Please try again.";
    if (!res.headersSent) {
      res.status(err?.status === 429 || err?.status === 401 ? err.status : 500).json({ error: userMessage });
    } else {
      res.write(`data: ${JSON.stringify({ error: userMessage })}\n\n`);
      res.end();
    }
  }
});

router.post("/ai/cover-letter", upload.single("resume"), async (req, res) => {
  try {
    let resumeText: string;

    if (req.file) {
      resumeText = await extractTextFromFile(req.file.buffer, req.file.mimetype, req.file.originalname);
      if (resumeText.trim().length < 50) {
        res.status(422).json({
          error:
            "We couldn't read text from this file. It may be a scanned image or corrupted. Try a text-based PDF or paste your resume instead.",
        });
        return;
      }
    } else {
      resumeText = (req.body as { resumeText?: string }).resumeText ?? "";
    }

    const jobDescription = (req.body as { jobDescription?: string }).jobDescription ?? "";

    if (!resumeText || !jobDescription) {
      res.status(400).json({ error: "resumeText and jobDescription are required" });
      return;
    }

    const credit = await consumeAiCredit(req.session.userId!);
    if (!credit.ok) {
      res.status(credit.status).json({ error: credit.message, limitReached: credit.status === 429 });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const controller = new AbortController();
    res.on("close", () => controller.abort());

    const stream = await getOpenAI().chat.completions.create(
      {
        model: "gpt-4o-mini",
        max_tokens: 1500,
        stream: true,
        messages: [
          {
            role: "system",
            content: `You are an expert career coach who writes compelling cover letters. Write a professional, personalized cover letter based on the applicant's resume and the job description.

The cover letter should:
1. Open with a strong hook that shows genuine interest in the role and company
2. Connect the applicant's specific experience to the job requirements
3. Highlight 2-3 concrete achievements from the resume that are most relevant
4. Show knowledge of the company/role from the job description
5. Close with a confident call to action
6. Be 3-4 paragraphs, professional but warm in tone

Return ONLY the cover letter body text (no address block, no date, no signature line). Start directly with "Dear Hiring Manager," and end after the closing paragraph. Do not include any commentary.`,
          },
          {
            role: "user",
            content: `Here is my resume:\n\n${resumeText}\n\n---\n\nHere is the job description:\n\n${jobDescription}\n\n---\n\nPlease write a tailored cover letter for this role.`,
          },
        ],
      },
      { signal: controller.signal },
    );

    for await (const chunk of stream) {
      if (controller.signal.aborted || res.writableEnded) break;
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    }
  } catch (err: any) {
    // Client disconnected / stream aborted — nothing left to send.
    if (res.writableEnded || err?.name === "AbortError" || err?.name === "APIUserAbortError") return;
    req.log.error({ err }, "AI cover letter error");
    const userMessage =
      err?.status === 429
        ? "OpenAI quota exceeded. Please check your API key's billing plan at platform.openai.com."
        : err?.status === 401
        ? "Invalid OpenAI API key. Please check your OPENAI_API_KEY secret."
        : "AI processing failed. Please try again.";
    if (!res.headersSent) {
      res.status(err?.status === 429 || err?.status === 401 ? err.status : 500).json({ error: userMessage });
    } else {
      res.write(`data: ${JSON.stringify({ error: userMessage })}\n\n`);
      res.end();
    }
  }
});

router.post("/ai/extract-job-context", async (req, res) => {
  try {
    const jobDescription = (req.body as { jobDescription?: string }).jobDescription ?? "";

    if (!jobDescription.trim()) {
      res.status(400).json({ error: "jobDescription is required" });
      return;
    }

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 100,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Extract the company name and job title from the job description. Return ONLY a JSON object with "company" and "title" string fields. If you cannot determine a value, set it to null. Do not include any other fields or explanation.`,
        },
        {
          role: "user",
          content: jobDescription.slice(0, 3000),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: { company?: string | null; title?: string | null } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {}

    res.json({
      company: typeof parsed.company === "string" ? parsed.company : null,
      title: typeof parsed.title === "string" ? parsed.title : null,
    });
  } catch (err: any) {
    req.log.error({ err }, "AI extract-job-context error");
    res.status(500).json({ company: null, title: null });
  }
});

router.get("/ai/usage", async (req, res) => {
  try {
    const usage = await getUsage(req.session.userId!);
    if (!usage) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    res.json(usage);
  } catch (err) {
    req.log.error({ err }, "AI usage error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
