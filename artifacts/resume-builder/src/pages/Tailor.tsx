import Layout from "@/components/Layout";
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { ResumeInput, ResumeInputValue } from "@/components/ResumeInput";
import { JobPostingInput } from "@/components/JobPostingInput";
import { DiffViewer } from "@/components/DiffViewer";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Copy, FileText, RefreshCw, GitCompare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMutation } from "@tanstack/react-query";
import { downloadResumeDocx, downloadResumePdf, buildFilename } from "@/lib/docx-export";
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

export default function Tailor() {
  const [step, setStep] = useState<"upload" | "input" | "processing" | "result">("upload");
  const [resumeInput, setResumeInput] = useState<ResumeInputValue>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [tailoredText, setTailoredText] = useState("");
  const [jobContext, setJobContext] = useState<JobContext | null>(null);
  const [originalResumeText, setOriginalResumeText] = useState("");
  const [showDiff, setShowDiff] = useState(false);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const hasResume = resumeInput !== null && (
    resumeInput.mode === "file" || resumeInput.text.trim().length > 0
  );

  const tailorMutation = useMutation({
    mutationFn: async () => {
      if (!resumeInput) throw new Error("No resume provided");

      const formData = new FormData();
      if (resumeInput.mode === "file") {
        formData.append("resume", resumeInput.file);
      } else {
        formData.append("resumeText", resumeInput.text);
      }
      formData.append("jobDescription", jobDescription);

      const controller = new AbortController();
      abortRef.current = controller;

      let result = "";

      await streamAIRequest(
        "/api/ai/tailor",
        formData,
        (chunk) => {
          result += chunk;
          setTailoredText(result);
        },
        controller.signal
      );

      return result;
    },
    onSuccess: () => {
      setStep("result");
      toast({
        title: "Resume Tailored!",
        description: "Your resume has been optimized for this job description.",
      });
    },
    onError: (err: Error) => {
      setStep("input");
      toast({
        variant: "destructive",
        title: "Failed to tailor resume",
        description: err.message,
      });
    },
  });

  const runTailor = () => {
    setStep("processing");
    setTailoredText("");
    fetchJobContext(jobDescription).then(setJobContext);
    tailorMutation.mutate();
  };

  const handleNext = () => {
    if (step === "upload" && hasResume) {
      setStep("input");
    } else if (step === "input" && jobDescription) {
      // Capture original text for diff (available in text/saved mode)
      if (resumeInput?.mode === "text") {
        setOriginalResumeText(resumeInput.text);
      } else {
        setOriginalResumeText("");
      }
      setJobContext(null);
      setShowDiff(false);
      runTailor();
    }
  };

  const handleRetailor = () => {
    setShowDiff(false);
    runTailor();
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(tailoredText);
    toast({ title: "Copied to clipboard" });
  };

  const handleDownloadDocx = async () => {
    try {
      await downloadResumeDocx(tailoredText, buildFilename("Tailored Resume", "docx", jobDescription, jobContext ?? undefined));
    } catch {
      toast({ variant: "destructive", title: "Download failed", description: "Could not generate the DOCX file." });
    }
  };

  const handleDownloadPdf = () => {
    try {
      downloadResumePdf(tailoredText, buildFilename("Tailored Resume", "pdf", jobDescription, jobContext ?? undefined));
    } catch {
      toast({ variant: "destructive", title: "Download failed", description: "Could not generate the PDF file." });
    }
  };

  const canDiff = !!originalResumeText && !!tailoredText;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto h-full flex flex-col">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold mb-2">Tailor Resume</h1>
          <p className="text-muted-foreground">Optimize your resume for a specific job posting to increase your interview chances.</p>

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
                <p className="text-sm text-muted-foreground">Paste your resume text or upload a PDF/DOCX file.</p>
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
                  {step === "result" ? "Job Description" : "Step 2: Job Details"}
                </h2>
                <div className="flex-1 min-h-0">
                  <JobPostingInput
                    value={jobDescription}
                    onChange={setJobDescription}
                    readOnly={step === "processing"}
                  />
                </div>
                {step === "input" && (
                  <div className="flex justify-end mt-4">
                    <Button onClick={handleNext} disabled={!jobDescription} className="gap-2">
                      Generate Tailored Resume <Sparkles className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                {step === "result" && (
                  <div className="flex justify-end mt-4">
                    <Button
                      onClick={handleRetailor}
                      disabled={!jobDescription}
                      variant="outline"
                      className="gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Re-tailor with edits
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Panel / Preview */}
          <div className="lg:col-span-7 bg-muted/30 rounded-xl border border-border/50 p-6 flex items-center justify-center relative min-h-[600px]">
            {step === "processing" ? (
              <div className="w-full h-full flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-primary">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    <span className="text-sm font-medium">Tailoring your resume…</span>
                  </div>
                </div>
                <ScrollArea className="flex-1 bg-white rounded-lg border border-border/50 p-6">
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                    {tailoredText || (
                      <span className="text-muted-foreground italic">Analyzing keywords and restructuring your resume…</span>
                    )}
                  </pre>
                </ScrollArea>
              </div>
            ) : step === "result" ? (
              <div className="w-full h-full flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <h3 className="font-semibold text-lg">
                    {showDiff ? "Diff View" : "Tailored Resume"}
                  </h3>
                  <div className="flex gap-2 flex-wrap">
                    {canDiff && (
                      <Button
                        variant={showDiff ? "default" : "outline"}
                        size="sm"
                        className="gap-2"
                        onClick={() => setShowDiff(!showDiff)}
                      >
                        <GitCompare className="w-4 h-4" />
                        {showDiff ? "Hide Diff" : "View Diff"}
                      </Button>
                    )}
                    {!showDiff && (
                      <>
                        <Button variant="outline" size="sm" className="gap-2" onClick={handleCopy}>
                          <Copy className="w-4 h-4" /> Copy Text
                        </Button>
                        <DownloadDropdown
                          onDownloadDocx={handleDownloadDocx}
                          onDownloadPdf={handleDownloadPdf}
                        />
                      </>
                    )}
                  </div>
                </div>
                {showDiff ? (
                  <DiffViewer original={originalResumeText} tailored={tailoredText} />
                ) : (
                  <ScrollArea className="flex-1 bg-white rounded-lg border border-border/50 p-6">
                    <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                      {tailoredText}
                    </pre>
                  </ScrollArea>
                )}
              </div>
            ) : (
              <div className="text-center text-muted-foreground space-y-4 opacity-50">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                  <FileText className="w-8 h-8" />
                </div>
                <p>Preview will appear here after processing</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
