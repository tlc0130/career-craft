import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Wand2, Trash2, Loader2, Calendar, ArrowLeft, Copy, GitCompare, PenLine, Building2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { DiffViewer } from "@/components/DiffViewer";
import { DownloadDropdown } from "@/components/DownloadDropdown";
import { downloadResumeDocx, downloadResumePdf, buildFilename } from "@/lib/docx-export";

interface TailoredResume {
  id: string;
  title: string;
  company: string | null;
  jobTitle: string | null;
  originalText: string;
  tailoredText: string;
  jobDescription: string;
  createdAt: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function TailoredResumes() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [items, setItems] = useState<TailoredResume[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TailoredResume | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login");
      return;
    }
    fetchItems();
  }, [user, authLoading]);

  async function fetchItems() {
    setLoading(true);
    try {
      const res = await fetch("/api/tailored-resumes", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load tailored resumes");
      setItems(await res.json());
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "Could not load.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this tailored resume? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/tailored-resumes/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete");
      setItems((prev) => prev.filter((r) => r.id !== id));
      if (selected?.id === id) setSelected(null);
      toast({ title: "Deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  }

  function handleCoverLetter(item: TailoredResume) {
    try {
      sessionStorage.setItem(
        "coverLetterSeed",
        JSON.stringify({ resumeText: item.tailoredText, jobDescription: item.jobDescription })
      );
    } catch {
      // ignore
    }
    navigate("/cover-letter");
  }

  function jobCtx(item: TailoredResume) {
    return { company: item.company, title: item.jobTitle };
  }

  // ----- Detail view -----
  if (selected) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto pb-20">
          <Button variant="ghost" size="sm" className="gap-2 mb-4" onClick={() => { setSelected(null); setShowDiff(false); }}>
            <ArrowLeft className="w-4 h-4" /> Back to all
          </Button>

          <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
            <div className="min-w-0">
              <h1 className="text-2xl font-display font-bold truncate">{selected.title}</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                <Calendar className="w-3.5 h-3.5" /> {formatDate(selected.createdAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant={showDiff ? "default" : "outline"} size="sm" className="gap-2" onClick={() => setShowDiff(!showDiff)}>
                <GitCompare className="w-4 h-4" /> {showDiff ? "Hide Diff" : "View Diff"}
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => handleCoverLetter(selected)}>
                <PenLine className="w-4 h-4" /> Cover Letter
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => handleCopy(selected.tailoredText)}>
                <Copy className="w-4 h-4" /> Copy
              </Button>
              <DownloadDropdown
                onDownloadDocx={async () => {
                  await downloadResumeDocx(selected.tailoredText, buildFilename("Tailored Resume", "docx", selected.jobDescription, jobCtx(selected)));
                }}
                onDownloadPdf={() => {
                  downloadResumePdf(selected.tailoredText, buildFilename("Tailored Resume", "pdf", selected.jobDescription, jobCtx(selected)));
                }}
              />
            </div>
          </div>

          {showDiff ? (
            <div className="h-[70vh]">
              <DiffViewer original={selected.originalText} tailored={selected.tailoredText} />
            </div>
          ) : (
            <ScrollArea className="h-[70vh] bg-white rounded-lg border border-border/50 p-6">
              <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                {selected.tailoredText}
              </pre>
            </ScrollArea>
          )}
        </div>
      </Layout>
    );
  }

  // ----- List view -----
  return (
    <Layout>
      <div className="max-w-4xl mx-auto pb-20">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold mb-2">Tailored Resumes</h1>
            <p className="text-muted-foreground">Every resume you've tailored is saved here automatically.</p>
          </div>
          <Button className="gap-2" onClick={() => navigate("/tailor")}>
            <Wand2 className="w-4 h-4" /> Tailor New
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Wand2 className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">No tailored resumes yet</h2>
              <p className="text-muted-foreground">Tailor a resume to a job posting and it'll be saved here automatically.</p>
            </div>
            <Button className="gap-2" onClick={() => navigate("/tailor")}>
              <Wand2 className="w-4 h-4" /> Tailor Your First Resume
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {items.map((item) => (
              <Card key={item.id} className="bg-card border-border/50 hover:border-primary/30 transition-all flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Wand2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{item.jobTitle || item.title}</CardTitle>
                      {item.company && (
                        <CardDescription className="truncate flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 shrink-0" /> {item.company}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pb-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" /> {formatDate(item.createdAt)}
                  </div>
                </CardContent>
                <CardFooter className="gap-2 pt-0">
                  <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => { setSelected(item); setShowDiff(false); }}>
                    View
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => handleCoverLetter(item)}>
                    <PenLine className="w-4 h-4" /> Cover Letter
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                  >
                    {deletingId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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
