import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, Trash2, Download, Plus, Crown, Loader2, Calendar, Pencil } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { printResume } from "@/lib/pdf-print";
import { ResumeContent } from "@/components/templates/types";

interface Resume {
  id: string;
  title: string;
  jobTitle: string | null;
  content: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const TEMPLATE_STORAGE_KEY = "selectedTemplate";

function getStoredTemplate(): string {
  try {
    return localStorage.getItem(TEMPLATE_STORAGE_KEY) ?? "classic";
  } catch {
    return "classic";
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function resumeContentFromRecord(record: Record<string, unknown>): ResumeContent {
  const c = record as any;
  return {
    contact: {
      firstName: c?.contact?.firstName ?? "",
      lastName: c?.contact?.lastName ?? "",
      title: c?.contact?.title ?? "",
      email: c?.contact?.email ?? "",
      phone: c?.contact?.phone ?? "",
      summary: c?.contact?.summary ?? "",
    },
    experience: Array.isArray(c?.experience) ? c.experience.map((e: any) => ({
      id: e.id ?? "",
      jobTitle: e.jobTitle ?? "",
      company: e.company ?? "",
      startDate: e.startDate ?? "",
      endDate: e.endDate ?? "",
      description: e.description ?? "",
    })) : [],
    education: Array.isArray(c?.education) ? c.education.map((e: any) => ({
      id: e.id ?? "",
      school: e.school ?? "",
      degree: e.degree ?? "",
      startYear: e.startYear ?? "",
      endYear: e.endYear ?? "",
    })) : [],
    skills: Array.isArray(c?.skills) ? c.skills : [],
  };
}

export default function MyResumes() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login");
      return;
    }
    fetchResumes();
  }, [user, authLoading]);

  async function fetchResumes() {
    setLoading(true);
    try {
      const res = await fetch("/api/resumes", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load resumes");
      setResumes(await res.json());
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "Could not load resumes.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this resume? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/resumes/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete");
      setResumes((prev) => prev.filter((r) => r.id !== id));
      toast({ title: "Resume deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  function handleExportPdf(resume: Resume) {
    const templateId = getStoredTemplate();
    const content = resumeContentFromRecord(resume.content);
    printResume(templateId, content, resume.title);
  }

  const isPro = user?.plan === "pro" || user?.lifetimeAccess;
  const atLimit = !isPro && resumes.length >= 1;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto pb-20">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold mb-2">My Resumes</h1>
            <p className="text-muted-foreground">
              {isPro
                ? "Unlimited resumes saved to your account."
                : `Starter plan: ${resumes.length}/1 resume saved.`}
            </p>
          </div>
          <Button
            className="gap-2"
            onClick={() => navigate("/builder")}
            disabled={atLimit}
            title={atLimit ? "Upgrade to Pro to save more resumes" : undefined}
          >
            <Plus className="w-4 h-4" /> New Resume
          </Button>
        </div>

        {!isPro && (
          <div className="mb-6 p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5 text-sm text-muted-foreground flex items-center gap-3">
            <Crown className="w-5 h-5 text-yellow-500 shrink-0" />
            <span>
              You're on the Starter plan (1 resume limit).{" "}
              <a href="/#pricing" className="text-primary underline">Upgrade to Pro</a> for unlimited saves.
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : resumes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
              <FileText className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">No resumes saved yet</h2>
              <p className="text-muted-foreground">Build a resume from scratch and save it to access it anytime.</p>
            </div>
            <Button className="gap-2" onClick={() => navigate("/builder")}>
              <Plus className="w-4 h-4" /> Build Your First Resume
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {resumes.map((resume) => (
              <Card key={resume.id} className="bg-card border-border/50 hover:border-primary/30 transition-all flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{resume.title}</CardTitle>
                      {resume.jobTitle && (
                        <CardDescription className="truncate">{resume.jobTitle}</CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pb-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {resume.updatedAt > resume.createdAt ? (
                            <span className="cursor-default underline decoration-dotted underline-offset-2">
                              Last edited {formatDate(resume.updatedAt)}
                            </span>
                          ) : (
                            <span className="cursor-default underline decoration-dotted underline-offset-2">
                              Saved {formatDate(resume.createdAt)}
                            </span>
                          )}
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          {resume.updatedAt > resume.createdAt
                            ? formatDateTime(resume.updatedAt)
                            : formatDateTime(resume.createdAt)}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardContent>
                <CardFooter className="gap-2 pt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => navigate(`/builder?resumeId=${resume.id}`)}
                  >
                    <Pencil className="w-4 h-4" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleExportPdf(resume)}
                  >
                    <Download className="w-4 h-4" /> Export PDF
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(resume.id)}
                    disabled={deletingId === resume.id}
                  >
                    {deletingId === resume.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
