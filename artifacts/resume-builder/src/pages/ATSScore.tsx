import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { BarChart2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// ATS Match Score result types
// ---------------------------------------------------------------------------
interface ATSScoreResult {
  score: number; // 0-100
  label: string; // e.g. "Good Match"
  foundKeywords: string[];
  missingKeywords: string[];
  suggestions: string[];
}

// ---------------------------------------------------------------------------
// Resume Score result types
// ---------------------------------------------------------------------------
interface SectionScore {
  name: string;
  score: number; // 0-100
  feedback: string;
}

interface ResumeScoreResult {
  score: number; // 0-100
  grade: string; // e.g. "B+"
  label: string;
  sections: SectionScore[];
  topImprovements: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function scoreColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-blue-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

function scoreBgColor(score: number): string {
  if (score >= 80) return "bg-green-500/10 border-green-500/30";
  if (score >= 60) return "bg-blue-500/10 border-blue-500/30";
  if (score >= 40) return "bg-orange-500/10 border-orange-500/30";
  return "bg-red-500/10 border-red-500/30";
}

function scoreBarColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-blue-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

// ---------------------------------------------------------------------------
// ATS Match Score Tab
// ---------------------------------------------------------------------------
function ATSMatchTab() {
  const { toast } = useToast();
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ATSScoreResult | null>(null);

  async function handleAnalyze() {
    if (!resumeText.trim() || !jobDescription.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/ai/ats-score", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, jobDescription }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error ?? "Request failed");
      }
      setResult(await res.json());
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Paste your resume and the job description to see how well they match and which keywords you're missing.
      </p>

      {/* Input area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Your Resume</label>
          <Textarea
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            placeholder="Paste your full resume text here…"
            className="min-h-[260px] resize-y font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Job Description</label>
          <Textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the full job posting here…"
            className="min-h-[260px] resize-y text-xs"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleAnalyze}
          disabled={loading || !resumeText.trim() || !jobDescription.trim()}
          className="gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />}
          {loading ? "Analyzing…" : "Analyze Match"}
        </Button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          {/* Score badge */}
          <div className="flex justify-center">
            <div
              className={`inline-flex flex-col items-center justify-center w-36 h-36 rounded-full border-4 ${scoreBgColor(result.score)}`}
            >
              <span className={`text-4xl font-bold font-display ${scoreColor(result.score)}`}>
                {result.score}%
              </span>
              <span className={`text-xs font-semibold mt-1 ${scoreColor(result.score)}`}>
                {result.label}
              </span>
            </div>
          </div>

          {/* Keywords */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-card border-green-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-green-400">
                  <CheckCircle2 className="w-4 h-4" />
                  Found Keywords ({result.foundKeywords.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.foundKeywords.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No matching keywords detected.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {result.foundKeywords.map((kw) => (
                      <Badge
                        key={kw}
                        className="bg-green-500/10 text-green-400 border border-green-500/20 text-xs"
                      >
                        {kw}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-red-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  Missing Keywords ({result.missingKeywords.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.missingKeywords.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Great — no critical keywords missing!</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {result.missingKeywords.map((kw) => (
                      <Badge
                        key={kw}
                        variant="outline"
                        className="border-dashed border-red-500/40 text-red-400 text-xs"
                      >
                        {kw}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Suggestions */}
          {result.suggestions.length > 0 && (
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Suggestions to Improve Your Match</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {result.suggestions.map((s, i) => (
                    <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 font-bold mt-0.5">
                        {i + 1}
                      </span>
                      {s}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resume Score Tab
// ---------------------------------------------------------------------------
function ResumeScoreTab() {
  const { toast } = useToast();
  const [resumeText, setResumeText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResumeScoreResult | null>(null);

  async function handleScore() {
    if (!resumeText.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/ai/resume-score", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error ?? "Request failed");
      }
      setResult(await res.json());
    } catch (err: any) {
      toast({ title: "Scoring failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Get an overall quality score for your resume with actionable feedback on each section.
      </p>

      <div className="space-y-2">
        <label className="text-sm font-medium">Your Resume</label>
        <Textarea
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          placeholder="Paste your full resume text here…"
          className="min-h-[280px] resize-y font-mono text-xs"
        />
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleScore}
          disabled={loading || !resumeText.trim()}
          className="gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />}
          {loading ? "Scoring…" : "Score My Resume"}
        </Button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          {/* Score badge */}
          <div className="flex justify-center">
            <div
              className={`inline-flex flex-col items-center justify-center w-36 h-36 rounded-full border-4 ${scoreBgColor(result.score)}`}
            >
              <span className={`text-4xl font-bold font-display ${scoreColor(result.score)}`}>
                {result.grade}
              </span>
              <span className={`text-sm font-semibold ${scoreColor(result.score)}`}>
                {result.score}%
              </span>
              <span className="text-xs text-muted-foreground mt-0.5">{result.label}</span>
            </div>
          </div>

          {/* Section scores */}
          {result.sections.length > 0 && (
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Section Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.sections.map((section) => (
                  <div key={section.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{section.name}</span>
                      <span className={`font-bold text-xs ${scoreColor(section.score)}`}>
                        {section.score}/100
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${scoreBarColor(section.score)}`}
                        style={{ width: `${section.score}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{section.feedback}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Top 3 improvements */}
          {result.topImprovements.length > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Top {result.topImprovements.length} Improvements
              </h3>
              <ol className="space-y-2">
                {result.topImprovements.map((item, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center shrink-0 font-bold mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ATSScore() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto pb-20">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold mb-2 flex items-center gap-3">
            <BarChart2 className="w-8 h-8 text-primary" />
            ATS Score
          </h1>
          <p className="text-muted-foreground">
            Analyze how well your resume matches a job description, or get an overall quality score.
          </p>
        </div>

        <Tabs defaultValue="ats-match">
          <TabsList className="mb-6">
            <TabsTrigger value="ats-match">ATS Match Score</TabsTrigger>
            <TabsTrigger value="resume-score">Resume Score</TabsTrigger>
          </TabsList>

          <TabsContent value="ats-match">
            <ATSMatchTab />
          </TabsContent>

          <TabsContent value="resume-score">
            <ResumeScoreTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
