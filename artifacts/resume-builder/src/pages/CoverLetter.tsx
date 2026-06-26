import Layout from "@/components/Layout";
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { ResumeInput, ResumeInputValue } from "@/components/ResumeInput";
import { JobPostingInput } from "@/components/JobPostingInput";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Copy, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMutation } from "@tanstack/react-query";
import { downloadCoverLetterDocx, downloadCoverLetterPdf, buildFilename } from "@/lib/docx-export";
import { DownloadDropdown } from "@/components/DownloadDropdown";
import { useAuth } from "@/lib/auth";

async function streamAIRequest(
  url: string,
  body: FormData,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    body,
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? "Request failed");
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const payload = JSON.parse(line.slice(6));
          if (payload.content) onChunk(payload.content);
          if (payload.error) throw new Error(payload.error);
        } catch {}
      }
    }
  }
}

type JobContext = { company: string | null; title: string | null };

async function fetchJobContext(jobDescription: string): Promise<JobContext> {
  try {
    const res = await fetch("/api/ai/extract-job-context", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobDescription }),
    });
    if (!res.ok) return { company: null, title: null };
    return await res.json();
  } catch {
    return { company: null, title: null };
  }
}

export default function CoverLetter() {
  const [step, setStep] = useState<"upload" | "input" | "processing" | "result">("upload");
  const [resumeInput, setResumeInput] = useState<ResumeInputValue>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [coverLetterText, setCoverLetterText] = useState("");
  const [jobContext, setJobContext] = useState<JobContext | null>(null);
  const [tone, setTone] = useState<"professional" | "conversational" | "creative" | "executive">("professional");
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const abortRef = useRef<AbortController | null>(null);
  const contactInfo = user
    ? { name: user.name ?? undefined, email: user.email, phone: user.phone ?? undefined }
    : undefined;

  // The AI endpoints require a session. Send unauthenticated visitors to log in.
  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  // If the user arrived here from "Generate Cover Letter" on a tailored resume,
  // pre-fill the resume + job description and jump straight to Job Details so
  // they never have to re-paste the posting.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("coverLetterSeed");
      if (!raw) return;
      sessionStorage.removeItem("coverLetterSeed");
      const seed = JSON.parse(raw) as { resumeText?: string; jobDescription?: string };
      if (seed.resumeText?.trim()) {
        setResumeInput({ mode: "text", text: seed.resumeText });
        if (seed.jobDescription?.trim()) setJobDescription(seed.jobDescription);
        setStep("input");
      }
    } catch {
      // ignore malformed seed
    }
  }, []);

  // Cancel any in-flight stream when leaving the page.
  useEffect(() => () => abortRef.current?.abort(), []);

  const hasResume = resumeInput !== null && (
    resumeInput.mode === "file" || resumeInput.text.trim().length > 0
  );

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!resumeInput) throw new Error("No resume provided");

      const formData = new FormData();
      if (resumeInput.mode === "file") {
        formData.append("resume", resumeInput.file);
      } else {
        formData.append("resumeText", resumeInput.text);
      }
      formData.append("jobDescription", jobDescription);
      formData.append("tone", tone);

      const controller = new AbortController();
      abortRef.current = controller;

      let result = "";

      await streamAIRequest(
        "/api/ai/cover-letter",
        formData,
        (chunk) => {
          result += chunk;
          setCoverLetterText(result);
        },
        controller.signal
      );

      return result;
    },
    onSuccess: () => {
      setStep("result");
      toast({
        title: "Cover Letter Generated!",
        description: "Your cover letter is ready for review.",
      });
    },
    onError: (err: Error) => {
      setStep("input");
      toast({
        variant: "destructive",
        title: "Failed to generate cover letter",
        description: err.message,
      });
    },
  });

  const handleNext = () => {
    if (step === "upload" && hasResume) {
      setStep("input");
    } else if (step === "input" && jobDescription) {
      setStep("processing");
      setCoverLetterText("");
      setJobContext(null);
      fetchJobContext(jobDescription).then(setJobContext);
      generateMutation.mutate();
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(coverLetterText);
    toast({ title: "Copied to clipboard" });
  };

  const handleDownloadDocx = async () => {
    try {
      await downloadCoverLetterDocx(coverLetterText, buildFilename("Cover Letter", "docx", jobDescription, jobContext ?? undefined), contactInfo);
    } catch {
      toast({ variant: "destructive", title: "Download failed", description: "Could not generate the DOCX file." });
    }
  };

  const handleDownloadPdf = () => {
    try {
      downloadCoverLetterPdf(coverLetterText, buildFilename("Cover Letter", "pdf", jobDescription, jobContext ?? undefined), contactInfo);
    } catch {
      toast({ variant: "destructive", title: "Download failed", description: "Could not generate the PDF file." });
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto h-full flex flex-col">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold mb-2">Cover Letter Generator</h1>
          <p className="text-muted-foreground">Create a persuasive cover letter tailored to the specific job requirements.</p>

          {/* Progress Steps */}
          <div className="flex items-center mt-6 gap-4 text-sm font-medium">
            <div className={`flex items-center gap-2 ${step === "upload" ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${step === "upload" ? "border-primary bg-primary/10" : "border-border"}`}>1</div>
              Your Resume
            </div>
            <div className="w-8 h-px bg-border" />
            <div className={`flex items-center gap-2 ${step === "input" ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${step === "input" ? "border-primary bg-primary/10" : "border-border"}`}>2</div>
              Job Details
            </div>
            <div className="w-8 h-px bg-border" />
            <div className={`flex items-center gap-2 ${step === "result" ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${step === "result" ? "border-primary bg-primary/10" : "border-border"}`}>3</div>
              Result
            </div>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0">
          {/* Left Panel */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {step === "upload" && (
              <div className="bg-card border border-border rounded-xl p-6 space-y-6 animate-in fade-in slide-in-from-left-4">
                <h2 className="text-lg font-semibold">Step 1: Your Resume</h2>
                <p className="text-sm text-muted-foreground">We use your resume to extract your experience and match it to the job.</p>
                <ResumeInput value={resumeInput} onChange={setResumeInput} />
                <div className="flex justify-end">
                  <Button onClick={handleNext} disabled={!hasResume} className="gap-2">
                    Next Step <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {(step === "input" || step === "processing" || step === "result") && (
              <div className="bg-card border border-border rounded-xl p-6 h-full flex flex-col animate-in fade-in slide-in-from-left-4">
                <h2 className="text-lg font-semibold mb-4">
                  {step === "result" ? "Job Description Used" : "Step 2: Job Details"}
                </h2>
                <div className="flex-1 min-h-0">
                  <JobPostingInput
                    value={jobDescription}
                    onChange={setJobDescription}
                  />
                </div>
                {step === "input" && (
                  <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Writing Style:</label>
                      <div className="flex flex-wrap gap-2">
                        {(["professional", "conversational", "creative", "executive"] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTone(t)}
                            className={`px-3 py-1 text-xs rounded-full border transition-colors capitalize ${
                              tone === t
                                ? "border-primary bg-primary/10 text-primary font-medium ring-1 ring-primary"
                                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={handleNext} disabled={!jobDescription} className="gap-2">
                        Generate Cover Letter <Sparkles className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Panel / Preview */}
          <div className="lg:col-span-7 bg-muted/30 rounded-xl border border-border/50 p-6 flex items-center justify-center relative min-h-[600px]">
            {step === "processing" ? (
              <div className="w-full h-full flex flex-col gap-4">
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  <span className="text-sm font-medium">Writing your cover letter…</span>
                </div>
                <ScrollArea className="flex-1 bg-white rounded-lg border border-border/50 p-6">
                  <div className="font-serif text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
                    {coverLetterText || (
                      <span className="text-muted-foreground italic">Crafting a compelling narrative tailored to this role…</span>
                    )}
                  </div>
                </ScrollArea>
              </div>
            ) : step === "result" ? (
              <div className="w-full h-full flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-lg">Generated Cover Letter</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2" onClick={handleCopy}>
                      <Copy className="w-4 h-4" /> Copy
                    </Button>
                    <DownloadDropdown
                      onDownloadDocx={handleDownloadDocx}
                      onDownloadPdf={handleDownloadPdf}
                    />
                  </div>
                </div>
                <ScrollArea className="flex-1 bg-white rounded-lg border border-border/50 p-8">
                  <div className="font-serif text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
                    {coverLetterText}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="text-center text-muted-foreground space-y-4 opacity-50">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                  <FileText className="w-8 h-8" />
                </div>
                <p>Cover letter preview will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
