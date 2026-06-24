import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BrainCircuit,
  Loader2,
  Users,
  Code2,
  Building2,
  Lightbulb,
  HelpCircle,
  Printer,
  RotateCcw,
  Info,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface QuestionItem {
  question: string;
  tip: string;
}

interface Category {
  name: string;
  questions: QuestionItem[];
}

interface PrepResult {
  categories: Category[];
}

// ---------------------------------------------------------------------------
// Category icon map
// ---------------------------------------------------------------------------
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Behavioral: Users,
  "Technical & Role-Specific": Code2,
  "Company & Culture": Building2,
  Situational: Lightbulb,
  "Questions to Ask": HelpCircle,
};

function getCategoryIcon(name: string): React.ElementType {
  for (const [key, Icon] of Object.entries(CATEGORY_ICONS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return Icon;
  }
  return HelpCircle;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function InterviewPrep() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PrepResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  async function handleGenerate() {
    if (!jobDescription.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/ai/interview-prep", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription,
          ...(resumeText.trim() ? { resumeText } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error ?? "Request failed");
      }
      const data: PrepResult = await res.json();
      setResult(data);
      // Scroll to results
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResult(null);
    setError(null);
    setJobDescription("");
    setResumeText("");
  }

  function handlePrint() {
    window.print();
  }

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!user) return null;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto pb-20">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold mb-2 flex items-center gap-3">
            <BrainCircuit className="w-8 h-8 text-primary" />
            Interview Prep
          </h1>
          <p className="text-muted-foreground">
            Paste a job description and let AI generate tailored interview questions with coaching tips.
          </p>
        </div>

        {/* Input section */}
        {!result && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Job description */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Job Description</label>
                <Textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the full job posting here..."
                  className="min-h-[280px] resize-y text-sm"
                />
              </div>
              {/* Resume (optional) */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Your Resume{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Textarea
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder="Paste your resume text to get personalized questions..."
                  className="min-h-[280px] resize-y text-sm font-mono"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleGenerate}
                disabled={loading || !jobDescription.trim()}
                className="gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating your interview questions...
                  </>
                ) : (
                  <>
                    <BrainCircuit className="w-4 h-4" />
                    Prepare Me
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div ref={resultsRef} className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            {/* Action buttons */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-xl font-display font-bold">Your Interview Questions</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Prepare Again
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
                  <Printer className="w-4 h-4" />
                  Print / Export
                </Button>
              </div>
            </div>

            {/* Category cards */}
            {result.categories.map((category) => {
              const Icon = getCategoryIcon(category.name);
              return (
                <Card key={category.name} className="bg-card border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-primary">
                      <Icon className="w-5 h-5 shrink-0" />
                      {category.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-5">
                      {category.questions.map((item, idx) => (
                        <li key={idx} className="space-y-1.5">
                          <p className="font-semibold text-sm text-foreground leading-snug break-words">
                            {idx + 1}. {item.question}
                          </p>
                          {item.tip && (
                            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <Info className="w-3.5 h-3.5 text-primary/70 shrink-0 mt-0.5" />
                              <span>
                                <span className="font-semibold text-primary/80">Tip: </span>
                                {item.tip}
                              </span>
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              );
            })}

            {/* Bottom buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleReset} className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Prepare Again
              </Button>
              <Button variant="outline" onClick={handlePrint} className="gap-2">
                <Printer className="w-4 h-4" />
                Print / Export
              </Button>
            </div>
          </div>
        )}

        {/* Post-generation error */}
        {error && result === null && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 mt-4">
            {error}
          </div>
        )}
      </div>
    </Layout>
  );
}
