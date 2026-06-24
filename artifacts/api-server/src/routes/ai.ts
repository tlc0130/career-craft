import { Router } from "express";
import OpenAI from "openai";
import multer from "multer";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import mammoth from "mammoth";
import { requireAuth } from "../middlewares/auth";
import { consumeAiCredit, getUsage } from "../lib/aiCredits";

const router = Router();

router.use(requireAuth);

// Lazily instantiated so the server can start (and serve health/auth routes)
// even if OPENROUTER_API_KEY isn't set. The first AI request will surface a
// clear error rather than crashing the process on boot.
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env["OPENROUTER_API_KEY"];
    if (!apiKey) {
      throw Object.assign(new Error("OPENROUTER_API_KEY environment variable is not set."), { status: 503 });
    }
    _openai = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env["APP_URL"] ?? "https://hiddentechdaily.com",
        "X-Title": "CareerCraft",
      },
    });
  }
  return _openai;
}

function getModel(fallback = "openai/gpt-4o-mini"): string {
  return process.env["OPENROUTER_MODEL"] ?? fallback;
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
        model: getModel(),
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
    if (res.writableEnded || err?.name === "AbortError" || err?.name === "APIUserAbortError") return;
    req.log.error({ err }, "AI tailor error");
    const userMessage =
      err?.status === 429
        ? "AI quota exceeded. Please check your OpenRouter billing at openrouter.ai."
        : err?.status === 401
        ? "Invalid OpenRouter API key. Please check your OPENROUTER_API_KEY."
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
    const toneRaw = (req.body as { tone?: string }).tone ?? "professional";
    const validTones = ["professional", "conversational", "creative", "executive"] as const;
    type Tone = (typeof validTones)[number];
    const tone: Tone = (validTones as readonly string[]).includes(toneRaw) ? (toneRaw as Tone) : "professional";

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
        model: getModel(),
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

Return ONLY the cover letter body text (no address block, no date, no signature line). Start directly with "Dear Hiring Manager," and end after the closing paragraph. Do not include any commentary. Write in a ${tone} tone.`,
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
    if (res.writableEnded || err?.name === "AbortError" || err?.name === "APIUserAbortError") return;
    req.log.error({ err }, "AI cover letter error");
    const userMessage =
      err?.status === 429
        ? "AI quota exceeded. Please check your OpenRouter billing at openrouter.ai."
        : err?.status === 401
        ? "Invalid OpenRouter API key. Please check your OPENROUTER_API_KEY."
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
      model: getModel(),
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

router.post("/ai/ats-score", async (req, res) => {
  try {
    const resumeText = (req.body as { resumeText?: string }).resumeText ?? "";
    const jobDescription = (req.body as { jobDescription?: string }).jobDescription ?? "";

    if (!resumeText || !jobDescription) {
      res.status(400).json({ error: "resumeText and jobDescription are required" });
      return;
    }

    const completion = await getOpenAI().chat.completions.create({
      model: getModel(),
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an ATS (Applicant Tracking System) expert. Analyze the resume against the job description and return a JSON object with exactly these fields:
- "score": integer 0-100 representing how well the resume matches the job description
- "label": string — use exactly "Weak Match" for 0-39, "Fair Match" for 40-59, "Good Match" for 60-79, "Strong Match" for 80-100
- "foundKeywords": array of strings — important keywords from the job description found in the resume
- "missingKeywords": array of strings — important keywords from the job description missing from the resume
- "suggestions": array of 2-4 strings — specific, actionable suggestions to improve the match score

Return ONLY the JSON object, no commentary.`,
        },
        {
          role: "user",
          content: `Resume:\n\n${resumeText}\n\n---\n\nJob Description:\n\n${jobDescription}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(500).json({ error: "Failed to parse AI response" });
      return;
    }

    res.json(parsed);
  } catch (err: any) {
    req.log.error({ err }, "AI ats-score error");
    const userMessage =
      err?.status === 429
        ? "AI quota exceeded. Please check your OpenRouter billing at openrouter.ai."
        : err?.status === 401
        ? "Invalid OpenRouter API key. Please check your OPENROUTER_API_KEY."
        : "AI processing failed. Please try again.";
    res.status(err?.status === 429 || err?.status === 401 ? err.status : 500).json({ error: userMessage });
  }
});

router.post("/ai/resume-score", async (req, res) => {
  try {
    const resumeText = (req.body as { resumeText?: string }).resumeText ?? "";

    if (!resumeText) {
      res.status(400).json({ error: "resumeText is required" });
      return;
    }

    const completion = await getOpenAI().chat.completions.create({
      model: getModel(),
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an expert resume reviewer. Analyze the resume and return a JSON object with exactly these fields:
- "overallScore": integer 0-100
- "grade": string — use exactly "A+" for 90-100, "A" for 80-89, "B" for 70-79, "C" for 60-69, "D" for 50-59, "F" for below 50
- "sections": array of exactly 5 objects, each with:
  - "name": string (use these names in order: "Impact & Metrics", "Action Verbs", "Skills Clarity", "Completeness", "ATS Readability")
  - "score": integer 0-100 for that section
  - "feedback": string with specific, actionable feedback for that section
- "topImprovements": array of 3 strings — the highest-priority improvements the candidate should make

Return ONLY the JSON object, no commentary.`,
        },
        {
          role: "user",
          content: `Resume:\n\n${resumeText}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(500).json({ error: "Failed to parse AI response" });
      return;
    }

    res.json(parsed);
  } catch (err: any) {
    req.log.error({ err }, "AI resume-score error");
    const userMessage =
      err?.status === 429
        ? "AI quota exceeded. Please check your OpenRouter billing at openrouter.ai."
        : err?.status === 401
        ? "Invalid OpenRouter API key. Please check your OPENROUTER_API_KEY."
        : "AI processing failed. Please try again.";
    res.status(err?.status === 429 || err?.status === 401 ? err.status : 500).json({ error: userMessage });
  }
});

router.post("/ai/generate-summary", async (req, res) => {
  try {
    const jobTitle = (req.body as { jobTitle?: string }).jobTitle ?? "";
    const experienceSnippets = (req.body as { experienceSnippets?: string }).experienceSnippets ?? "";

    if (!jobTitle || !experienceSnippets) {
      res.status(400).json({ error: "jobTitle and experienceSnippets are required" });
      return;
    }

    const completion = await getOpenAI().chat.completions.create({
      model: getModel(),
      max_tokens: 200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a professional resume writer. Return ONLY valid JSON with one field.",
        },
        {
          role: "user",
          content: `Write a compelling 2-3 sentence professional summary for someone whose title is: ${jobTitle}. Their experience includes: ${experienceSnippets}. Make it achievement-focused and ATS-friendly. Return JSON: {"summary": "..."}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(500).json({ error: "Failed to parse AI response" });
      return;
    }

    res.json(parsed);
  } catch (err: any) {
    req.log.error({ err }, "AI generate-summary error");
    const userMessage =
      err?.status === 429
        ? "AI quota exceeded. Please check your OpenRouter billing at openrouter.ai."
        : err?.status === 401
        ? "Invalid OpenRouter API key. Please check your OPENROUTER_API_KEY."
        : "AI processing failed. Please try again.";
    res.status(err?.status === 429 || err?.status === 401 ? err.status : 500).json({ error: userMessage });
  }
});

router.post("/ai/generate-bullets", async (req, res) => {
  try {
    const jobTitle = (req.body as { jobTitle?: string }).jobTitle ?? "";
    const company = (req.body as { company?: string }).company ?? "";
    const roleDescription = (req.body as { roleDescription?: string }).roleDescription ?? "";

    if (!jobTitle || !company || !roleDescription) {
      res.status(400).json({ error: "jobTitle, company, and roleDescription are required" });
      return;
    }

    const completion = await getOpenAI().chat.completions.create({
      model: getModel(),
      max_tokens: 300,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a professional resume writer. Return ONLY valid JSON with one field.",
        },
        {
          role: "user",
          content: `Convert these raw notes into 3-4 strong resume bullet points for a ${jobTitle} role at ${company}. Raw notes: ${roleDescription}. Each bullet should start with a strong action verb and include quantifiable results where possible. Return JSON: {"bullets": ["bullet 1", "bullet 2", ...]}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(500).json({ error: "Failed to parse AI response" });
      return;
    }

    res.json(parsed);
  } catch (err: any) {
    req.log.error({ err }, "AI generate-bullets error");
    const userMessage =
      err?.status === 429
        ? "AI quota exceeded. Please check your OpenRouter billing at openrouter.ai."
        : err?.status === 401
        ? "Invalid OpenRouter API key. Please check your OPENROUTER_API_KEY."
        : "AI processing failed. Please try again.";
    res.status(err?.status === 429 || err?.status === 401 ? err.status : 500).json({ error: userMessage });
  }
});

router.post("/ai/interview-prep", async (req, res) => {
  try {
    const jobDescription = (req.body as { jobDescription?: string }).jobDescription ?? "";
    const resumeText = (req.body as { resumeText?: string }).resumeText;

    if (!jobDescription) {
      res.status(400).json({ error: "jobDescription is required" });
      return;
    }

    const completion = await getOpenAI().chat.completions.create({
      model: getModel(),
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a professional career coach helping candidates prepare for job interviews. Return ONLY valid JSON.",
        },
        {
          role: "user",
          content: `Generate interview preparation questions for this job: ${jobDescription}. ${resumeText ? "Candidate resume: " + resumeText : ""} Return exactly this JSON structure: {"categories": [{"name": string, "questions": [{"question": string, "tip": string}]}]}. Include 5 categories: 'Behavioral', 'Technical & Role-Specific', 'Company & Culture', 'Situational', 'Questions to Ask'. Include 3-4 questions per category with a brief answering tip for each.`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(500).json({ error: "Failed to parse AI response" });
      return;
    }

    res.json(parsed);
  } catch (err: any) {
    req.log.error({ err }, "AI interview-prep error");
    const userMessage =
      err?.status === 429
        ? "AI quota exceeded. Please check your OpenRouter billing at openrouter.ai."
        : err?.status === 401
        ? "Invalid OpenRouter API key. Please check your OPENROUTER_API_KEY."
        : "AI processing failed. Please try again.";
    res.status(err?.status === 429 || err?.status === 401 ? err.status : 500).json({ error: userMessage });
  }
});

router.post("/ai/skills-gap", async (req, res) => {
  try {
    const resumeText = (req.body as { resumeText?: string }).resumeText ?? "";
    const jobDescription = (req.body as { jobDescription?: string }).jobDescription ?? "";

    if (!resumeText || !jobDescription) {
      res.status(400).json({ error: "resumeText and jobDescription are required" });
      return;
    }

    const completion = await getOpenAI().chat.completions.create({
      model: getModel(),
      max_tokens: 600,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a career development coach. Return ONLY valid JSON.",
        },
        {
          role: "user",
          content: `Analyze the gap between this candidate's resume and the job description. Resume: ${resumeText}. Job: ${jobDescription}. Return JSON: {"hasSkills": [string], "missingTechnical": [string], "missingSoft": [string], "prioritySkill": string, "learningPath": [{"skill": string, "how": string}]}. missingTechnical should list up to 6 hard/technical skills. missingSoft should list up to 4 soft skills. learningPath should give 3-4 specific, actionable ways to gain the top missing skills.`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(500).json({ error: "Failed to parse AI response" });
      return;
    }

    res.json(parsed);
  } catch (err: any) {
    req.log.error({ err }, "AI skills-gap error");
    const userMessage =
      err?.status === 429
        ? "AI quota exceeded. Please check your OpenRouter billing at openrouter.ai."
        : err?.status === 401
        ? "Invalid OpenRouter API key. Please check your OPENROUTER_API_KEY."
        : "AI processing failed. Please try again.";
    res.status(err?.status === 429 || err?.status === 401 ? err.status : 500).json({ error: userMessage });
  }
});

router.post("/ai/import-linkedin", async (req, res) => {
  try {
    if (!req.session?.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const profileText = (req.body as { profileText?: string }).profileText ?? "";

    if (!profileText.trim()) {
      res.status(400).json({ error: "profileText is required" });
      return;
    }

    const completion = await getOpenAI().chat.completions.create({
      model: getModel(),
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a professional resume parser. Extract structured resume data from LinkedIn profile text. Return ONLY valid JSON matching the exact schema provided.",
        },
        {
          role: "user",
          content: `Parse this LinkedIn profile text into a structured resume. LinkedIn text: ${profileText}

Return this exact JSON structure (all fields optional except where shown):
{
  "contact": {
    "firstName": string,
    "lastName": string,
    "title": string,
    "email": "",
    "phone": "",
    "summary": string,
    "location": string,
    "linkedin": string
  },
  "experience": [
    {
      "id": "exp-1",
      "jobTitle": string,
      "company": string,
      "startDate": string,
      "endDate": string,
      "description": string
    }
  ],
  "education": [
    {
      "id": "edu-1",
      "school": string,
      "degree": string,
      "startYear": string,
      "endYear": string
    }
  ],
  "skills": [string]
}

Rules:
- firstName/lastName: split the full name
- title: their current or most recent job title
- summary: the About section text
- location: city/region if mentioned
- linkedin: leave empty string (user will fill in)
- email/phone: always empty string (not on LinkedIn)
- For experience: list most recent first, use "Present" for current role endDate
- For education: degree should include field of study
- startDate/endDate format: "YYYY-MM" or "YYYY" or "Present"
- Skills: extract from Skills section, max 20
- Generate unique ids like "exp-1", "exp-2", "edu-1", "edu-2"
- If a section has no data, return empty array`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(500).json({ error: "Failed to parse profile" });
      return;
    }

    res.json(parsed);
  } catch (err: any) {
    req.log.error({ err }, "AI import-linkedin error");
    const userMessage =
      err?.status === 429
        ? "AI quota exceeded. Please check your OpenRouter billing at openrouter.ai."
        : err?.status === 401
        ? "Invalid OpenRouter API key. Please check your OPENROUTER_API_KEY."
        : "AI processing failed. Please try again.";
    res.status(err?.status === 429 || err?.status === 401 ? err.status : 500).json({ error: userMessage });
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
