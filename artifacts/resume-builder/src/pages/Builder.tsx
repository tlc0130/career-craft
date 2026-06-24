import { useState, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, ArrowRight, Save, X, Crown, Loader2, Download, FileText, Wand2, Linkedin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import TemplateSelector from "@/components/TemplateSelector";
import TemplateRenderer from "@/components/TemplateRenderer";
import { printResume } from "@/lib/pdf-print";

interface Experience {
  id: string;
  jobTitle: string;
  company: string;
  startDate: string;
  endDate: string;
  description: string;
}

interface Education {
  id: string;
  school: string;
  degree: string;
  startYear: string;
  endYear: string;
}

interface ResumeContent {
  contact: {
    firstName: string;
    lastName: string;
    title: string;
    email: string;
    phone: string;
    summary: string;
    location?: string;
    linkedin?: string;
    website?: string;
  };
  experience: Experience[];
  education: Education[];
  skills: string[];
}

function makeId() {
  return Math.random().toString(36).slice(2);
}

function makeEmptyExperience(): Experience {
  return { id: makeId(), jobTitle: "", company: "", startDate: "", endDate: "", description: "" };
}

function makeEmptyEducation(): Education {
  return { id: makeId(), school: "", degree: "", startYear: "", endYear: "" };
}

const TEMPLATE_STORAGE_KEY = "selectedTemplate";

export default function Builder() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const search = useSearch();
  const resumeId = new URLSearchParams(search).get("resumeId");
  const isEditing = Boolean(resumeId);

  const [resumeTitle, setResumeTitle] = useState("My Resume");
  const [saving, setSaving] = useState(false);
  const [loadingResume, setLoadingResume] = useState(isEditing);
  const [activeTab, setActiveTab] = useState("contact");

  const [contact, setContact] = useState({
    firstName: "", lastName: "", title: "", email: "", phone: "", summary: "",
    location: "", linkedin: "", website: "",
  });

  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [generatingBullets, setGeneratingBullets] = useState<Record<string, boolean>>({});
  const [bulletsErrors, setBulletsErrors] = useState<Record<string, string>>({});

  const [showLinkedInImport, setShowLinkedInImport] = useState(false);
  const [linkedInText, setLinkedInText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);

  const [experiences, setExperiences] = useState<Experience[]>([makeEmptyExperience()]);
  const [education, setEducation] = useState<Education[]>([makeEmptyEducation()]);
  const [skills, setSkills] = useState<string[]>(["JavaScript", "TypeScript", "React", "Node.js"]);
  const [skillInput, setSkillInput] = useState("");

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
    try {
      return localStorage.getItem(TEMPLATE_STORAGE_KEY) ?? "classic";
    } catch {
      return "classic";
    }
  });

  const isDirtyRef = useRef(false);
  const isInitializing = useRef(true);

  function markDirty() {
    if (!isInitializing.current) {
      isDirtyRef.current = true;
    }
  }

  function markClean() {
    isDirtyRef.current = false;
  }

  function confirmLeave(): boolean {
    if (!isDirtyRef.current) return true;
    return window.confirm("You have unsaved changes. Leave anyway?");
  }

  function safeNavigate(path: string) {
    if (confirmLeave()) {
      markClean();
      navigate(path);
    }
  }

  function handleTemplateSelect(id: string) {
    setSelectedTemplateId(id);
    try {
      localStorage.setItem(TEMPLATE_STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    const originalPushState = window.history.pushState.bind(window.history);

    window.history.pushState = function (...args: Parameters<typeof window.history.pushState>) {
      if (isDirtyRef.current) {
        if (!window.confirm("You have unsaved changes. Leave anyway?")) {
          return;
        }
        isDirtyRef.current = false;
      }
      return originalPushState(...args);
    };

    return () => {
      window.history.pushState = originalPushState;
    };
  }, []);

  useEffect(() => {
    const builderPath = window.location.pathname + window.location.search;

    const handlePopState = () => {
      if (!isDirtyRef.current) return;

      const targetPath = window.location.pathname + window.location.search;

      isDirtyRef.current = false;
      window.history.pushState(null, "", builderPath);
      isDirtyRef.current = true;

      if (window.confirm("You have unsaved changes. Leave anyway?")) {
        isDirtyRef.current = false;
        navigate(targetPath);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!resumeId) {
      isInitializing.current = false;
      return;
    }

    async function loadResume() {
      setLoadingResume(true);
      try {
        const res = await fetch(`/api/resumes/${resumeId}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load resume");
        const data = await res.json();
        const c = data.content as any;

        setResumeTitle(data.title ?? "My Resume");

        if (c?.contact) {
          setContact({
            firstName: c.contact.firstName ?? "",
            lastName: c.contact.lastName ?? "",
            title: c.contact.title ?? "",
            email: c.contact.email ?? "",
            phone: c.contact.phone ?? "",
            summary: c.contact.summary ?? "",
            location: c.contact.location ?? "",
            linkedin: c.contact.linkedin ?? "",
            website: c.contact.website ?? "",
          });
        }

        if (Array.isArray(c?.experience) && c.experience.length > 0) {
          setExperiences(c.experience.map((e: any) => ({
            id: e.id ?? makeId(),
            jobTitle: e.jobTitle ?? "",
            company: e.company ?? "",
            startDate: e.startDate ?? "",
            endDate: e.endDate ?? "",
            description: e.description ?? "",
          })));
        }

        if (Array.isArray(c?.education) && c.education.length > 0) {
          setEducation(c.education.map((e: any) => ({
            id: e.id ?? makeId(),
            school: e.school ?? "",
            degree: e.degree ?? "",
            startYear: e.startYear ?? "",
            endYear: e.endYear ?? "",
          })));
        }

        if (Array.isArray(c?.skills) && c.skills.length > 0) {
          setSkills(c.skills);
        }
      } catch (err: any) {
        toast({ title: "Could not load resume", description: err.message ?? "Please try again.", variant: "destructive" });
        navigate("/my-resumes");
      } finally {
        isInitializing.current = false;
        setLoadingResume(false);
      }
    }

    loadResume();
  }, [resumeId]);

  function addSkill() {
    const s = skillInput.trim();
    if (s && !skills.includes(s)) {
      setSkills((prev) => [...prev, s]);
      markDirty();
    }
    setSkillInput("");
  }

  function removeSkill(skill: string) {
    setSkills((prev) => prev.filter((s) => s !== skill));
    markDirty();
  }

  function addExperience() {
    setExperiences((prev) => [...prev, makeEmptyExperience()]);
    markDirty();
  }

  function removeExperience(id: string) {
    setExperiences((prev) => prev.filter((e) => e.id !== id));
    markDirty();
  }

  function updateExperience(id: string, field: keyof Experience, value: string) {
    setExperiences((prev) => prev.map((e) => e.id === id ? { ...e, [field]: value } : e));
    markDirty();
  }

  function addEducation() {
    setEducation((prev) => [...prev, makeEmptyEducation()]);
    markDirty();
  }

  function removeEducation(id: string) {
    setEducation((prev) => prev.filter((e) => e.id !== id));
    markDirty();
  }

  function updateEducation(id: string, field: keyof Education, value: string) {
    setEducation((prev) => prev.map((e) => e.id === id ? { ...e, [field]: value } : e));
    markDirty();
  }

  async function handleGenerateSummary() {
    setGeneratingSummary(true);
    setSummaryError("");
    try {
      const experienceSnippets = experiences.slice(0, 2)
        .map((e) => `${e.jobTitle} at ${e.company}: ${e.description.slice(0, 100)}`)
        .join("; ");
      const res = await fetch("/api/ai/generate-summary", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle: contact.title, experienceSnippets }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error ?? "Request failed");
      }
      const data = await res.json();
      setContact((c) => ({ ...c, summary: data.summary }));
      markDirty();
    } catch (err: any) {
      setSummaryError(err.message ?? "Failed to generate summary");
    } finally {
      setGeneratingSummary(false);
    }
  }

  async function handleGenerateBullets(expId: string) {
    const entry = experiences.find((e) => e.id === expId);
    if (!entry) return;
    setGeneratingBullets((prev) => ({ ...prev, [expId]: true }));
    setBulletsErrors((prev) => ({ ...prev, [expId]: "" }));
    try {
      const res = await fetch("/api/ai/generate-bullets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: entry.jobTitle,
          company: entry.company,
          roleDescription: entry.description || `${entry.jobTitle} at ${entry.company}`,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error ?? "Request failed");
      }
      const data = await res.json();
      const bulletsText = (data.bullets as string[]).map((b) => `• ${b}`).join("\n");
      updateExperience(expId, "description", bulletsText);
    } catch (err: any) {
      setBulletsErrors((prev) => ({ ...prev, [expId]: err.message ?? "Failed to generate bullets" }));
    } finally {
      setGeneratingBullets((prev) => ({ ...prev, [expId]: false }));
    }
  }

  async function handleSave() {
    if (!user) {
      safeNavigate("/login");
      return;
    }

    setSaving(true);
    try {
      const content: ResumeContent = { contact, experience: experiences, education, skills };

      const url = isEditing ? `/api/resumes/${resumeId}` : "/api/resumes";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: resumeTitle,
          jobTitle: contact.title || undefined,
          content,
        }),
      });

      if (res.status === 403) {
        const data = await res.json();
        toast({
          title: "Upgrade required",
          description: data.message ?? "Upgrade to Pro to save unlimited resumes.",
          variant: "destructive",
        });
        return;
      }

      if (!res.ok) {
        throw new Error(isEditing ? "Failed to update resume" : "Failed to save resume");
      }

      toast({
        title: isEditing ? "Resume updated!" : "Resume saved!",
        description: "You can find it in My Resumes.",
      });
      markClean();
      navigate("/my-resumes");
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function handleDownloadPdf() {
    const content: ResumeContent = { contact, experience: experiences, education, skills };
    printResume(selectedTemplateId, content, resumeTitle);
  }

  async function handleLinkedInImport() {
    if (!linkedInText.trim()) return;
    setImporting(true);
    setImportError('');
    try {
      const res = await fetch('/api/ai/import-linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ profileText: linkedInText }),
      });
      if (!res.ok) throw new Error('Import failed');
      const imported = await res.json();
      // Merge: preserve existing email/phone if already filled in
      setContact((prev) => ({
        firstName: imported.contact?.firstName ?? prev.firstName,
        lastName: imported.contact?.lastName ?? prev.lastName,
        title: imported.contact?.title ?? prev.title,
        email: prev.email || imported.contact?.email || '',
        phone: prev.phone || imported.contact?.phone || '',
        summary: imported.contact?.summary ?? prev.summary,
        location: imported.contact?.location ?? prev.location,
        linkedin: imported.contact?.linkedin ?? prev.linkedin,
        website: prev.website,
      }));
      if (Array.isArray(imported.experience) && imported.experience.length > 0) {
        setExperiences(imported.experience);
      }
      if (Array.isArray(imported.education) && imported.education.length > 0) {
        setEducation(imported.education);
      }
      if (Array.isArray(imported.skills) && imported.skills.length > 0) {
        setSkills(imported.skills);
      }
      markDirty();
      setShowLinkedInImport(false);
      setLinkedInText('');
      setImportSuccess(true);
      setActiveTab('contact');
      setTimeout(() => setImportSuccess(false), 5000);
    } catch (err) {
      setImportError('Import failed. Please try again or paste more complete profile text.');
    } finally {
      setImporting(false);
    }
  }

  if (loadingResume) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-40">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const saveLabel = isEditing ? "Update Resume" : "Save Resume";
  const finishLabel = isEditing ? "Update Resume" : "Finish & Save";

  const resumeContent: ResumeContent = { contact, experience: experiences, education, skills };

  // Preview scale: show at ~50% for a decent page preview
  const PREVIEW_SCALE = 0.5;
  const PREVIEW_WIDTH = Math.round(794 * PREVIEW_SCALE);
  const PREVIEW_HEIGHT = Math.round(1123 * PREVIEW_SCALE);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto pb-20">
        <div className="flex items-center justify-between mb-8 gap-4">
          <div className="flex-1 min-w-0">
            <Input
              value={resumeTitle}
              onChange={(e) => { setResumeTitle(e.target.value); markDirty(); }}
              className="text-2xl font-display font-bold border-0 border-b rounded-none px-0 focus-visible:ring-0 bg-transparent h-auto py-1 mb-1"
            />
            <p className="text-muted-foreground text-sm">
              {isEditing
                ? "Edit your saved resume and update it when you're done."
                : "Build a professional resume from scratch using our guided wizard."}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" className="gap-2" onClick={() => setShowLinkedInImport(true)}>
              <Linkedin className="w-4 h-4" />
              Import from LinkedIn
            </Button>
            <Button className="gap-2" onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4" />
              {saving ? (isEditing ? "Updating…" : "Saving…") : saveLabel}
            </Button>
          </div>
        </div>

        {importSuccess && (
          <div className="mb-4 p-3 rounded-lg border border-green-500/20 bg-green-500/10 text-sm text-green-700 dark:text-green-400">
            Profile imported! Review and edit the fields below.
          </div>
        )}

        <Dialog open={showLinkedInImport} onOpenChange={(open) => { setShowLinkedInImport(open); if (!open) { setLinkedInText(''); setImportError(''); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Linkedin className="w-5 h-5 text-[#0A66C2]" />
                Import from LinkedIn
              </DialogTitle>
              <DialogDescription>
                Copy your LinkedIn profile and paste it below. We'll extract your experience, education, and skills automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-3 text-sm text-blue-800 dark:text-blue-300 space-y-1">
                <p className="font-medium">How to copy your LinkedIn profile:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-blue-700 dark:text-blue-400">
                  <li>Go to your LinkedIn profile page</li>
                  <li>Select all text on the page (Ctrl+A / Cmd+A)</li>
                  <li>Copy (Ctrl+C / Cmd+C)</li>
                  <li>Paste below</li>
                </ol>
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkedinText">LinkedIn Profile Text</Label>
                <Textarea
                  id="linkedinText"
                  className="min-h-[160px]"
                  placeholder="Paste your LinkedIn profile text here..."
                  value={linkedInText}
                  onChange={(e) => setLinkedInText(e.target.value)}
                />
              </div>
              {importError && (
                <p className="text-sm text-destructive">{importError}</p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setShowLinkedInImport(false); setLinkedInText(''); setImportError(''); }}
                  disabled={importing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleLinkedInImport}
                  disabled={importing || !linkedInText.trim()}
                  className="gap-2"
                >
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Linkedin className="w-4 h-4" />}
                  {importing ? 'Importing...' : 'Import Profile'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {!user && (
          <div className="mb-6 p-4 rounded-lg border border-primary/20 bg-primary/5 text-sm text-muted-foreground flex items-center gap-3">
            <Crown className="w-5 h-5 text-primary shrink-0" />
            <span><a href="/login" className="text-primary underline">Sign in</a> to save and manage your resumes.</span>
          </div>
        )}

        {user && user.plan === "starter" && !user.lifetimeAccess && (
          <div className="mb-6 p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5 text-sm text-muted-foreground flex items-center gap-3">
            <Crown className="w-5 h-5 text-yellow-500 shrink-0" />
            <span>Starter plan: save up to 1 resume. <a href="/#pricing" className="text-primary underline">Upgrade to Pro</a> for unlimited saves.</span>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-8">
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="experience">Experience</TabsTrigger>
            <TabsTrigger value="education">Education</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="contact" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <Card>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" placeholder="John" value={contact.firstName} onChange={(e) => { setContact((c) => ({ ...c, firstName: e.target.value })); markDirty(); }} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" placeholder="Doe" value={contact.lastName} onChange={(e) => { setContact((c) => ({ ...c, lastName: e.target.value })); markDirty(); }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Professional Title</Label>
                  <Input id="title" placeholder="e.g. Senior Product Manager" value={contact.title} onChange={(e) => { setContact((c) => ({ ...c, title: e.target.value })); markDirty(); }} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="john@example.com" value={contact.email} onChange={(e) => { setContact((c) => ({ ...c, email: e.target.value })); markDirty(); }} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" placeholder="+1 (555) 000-0000" value={contact.phone} onChange={(e) => { setContact((c) => ({ ...c, phone: e.target.value })); markDirty(); }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input id="location" placeholder="City, State or Remote" value={contact.location} onChange={(e) => { setContact((c) => ({ ...c, location: e.target.value })); markDirty(); }} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="linkedin">LinkedIn</Label>
                    <Input id="linkedin" placeholder="linkedin.com/in/your-name" value={contact.linkedin} onChange={(e) => { setContact((c) => ({ ...c, linkedin: e.target.value })); markDirty(); }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" placeholder="yourportfolio.com" value={contact.website} onChange={(e) => { setContact((c) => ({ ...c, website: e.target.value })); markDirty(); }} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="summary">Professional Summary</Label>
                  <textarea
                    id="summary"
                    className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Briefly describe your professional background and key achievements..."
                    value={contact.summary}
                    onChange={(e) => { setContact((c) => ({ ...c, summary: e.target.value })); markDirty(); }}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs h-7 px-2"
                      onClick={handleGenerateSummary}
                      disabled={generatingSummary}
                    >
                      {generatingSummary ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                      {generatingSummary ? "Generating..." : "Generate with AI ✨"}
                    </Button>
                    {summaryError && <span className="text-xs text-destructive">{summaryError}</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-end">
              <Button className="gap-2" onClick={() => setActiveTab("experience")}>Next: Experience <ArrowRight className="w-4 h-4" /></Button>
            </div>
          </TabsContent>

          <TabsContent value="experience" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <Card>
              <CardContent className="pt-6 space-y-6">
                {experiences.map((exp, idx) => (
                  <div key={exp.id} className="border-l-2 border-primary/20 pl-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Job Title</Label>
                        <Input placeholder="e.g. Software Engineer" value={exp.jobTitle} onChange={(e) => updateExperience(exp.id, "jobTitle", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Company</Label>
                        <Input placeholder="e.g. Tech Corp" value={exp.company} onChange={(e) => updateExperience(exp.id, "company", e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Date</Label>
                        <Input type="month" value={exp.startDate} onChange={(e) => updateExperience(exp.id, "startDate", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>End Date</Label>
                        <Input type="month" value={exp.endDate} onChange={(e) => updateExperience(exp.id, "endDate", e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <textarea
                        className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Describe your responsibilities and achievements..."
                        value={exp.description}
                        onChange={(e) => updateExperience(exp.id, "description", e.target.value)}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-xs h-7 px-2"
                          onClick={() => handleGenerateBullets(exp.id)}
                          disabled={generatingBullets[exp.id]}
                        >
                          {generatingBullets[exp.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                          {generatingBullets[exp.id] ? "Generating..." : "✨ Generate bullets"}
                        </Button>
                        {bulletsErrors[exp.id] && <span className="text-xs text-destructive">{bulletsErrors[exp.id]}</span>}
                      </div>
                    </div>
                    {experiences.length > 1 && (
                      <Button variant="destructive" size="sm" className="gap-2" onClick={() => removeExperience(exp.id)}>
                        <Trash2 className="w-4 h-4" /> Remove
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" className="w-full border-dashed gap-2" onClick={addExperience}>
                  <Plus className="w-4 h-4" /> Add Another Position
                </Button>
              </CardContent>
            </Card>
            <div className="flex justify-end">
              <Button className="gap-2" onClick={() => setActiveTab("education")}>Next: Education <ArrowRight className="w-4 h-4" /></Button>
            </div>
          </TabsContent>

          <TabsContent value="education" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <Card>
              <CardContent className="pt-6 space-y-6">
                {education.map((edu) => (
                  <div key={edu.id} className="border-l-2 border-primary/20 pl-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>School / University</Label>
                        <Input placeholder="e.g. University of Technology" value={edu.school} onChange={(e) => updateEducation(edu.id, "school", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Degree</Label>
                        <Input placeholder="e.g. Bachelor of Science in Computer Science" value={edu.degree} onChange={(e) => updateEducation(edu.id, "degree", e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Year</Label>
                        <Input type="number" placeholder="2016" value={edu.startYear} onChange={(e) => updateEducation(edu.id, "startYear", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>End Year (or Expected)</Label>
                        <Input type="number" placeholder="2020" value={edu.endYear} onChange={(e) => updateEducation(edu.id, "endYear", e.target.value)} />
                      </div>
                    </div>
                    {education.length > 1 && (
                      <Button variant="destructive" size="sm" className="gap-2" onClick={() => removeEducation(edu.id)}>
                        <Trash2 className="w-4 h-4" /> Remove
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" className="w-full border-dashed gap-2 hover:border-primary/50 hover:bg-primary/5" onClick={addEducation}>
                  <Plus className="w-4 h-4" /> Add Another Education
                </Button>
              </CardContent>
            </Card>
            <div className="flex justify-end">
              <Button className="gap-2" onClick={() => setActiveTab("skills")}>Next: Skills <ArrowRight className="w-4 h-4" /></Button>
            </div>
          </TabsContent>

          <TabsContent value="skills" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <Card>
              <CardContent className="pt-6 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Add a Skill</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g. React, Project Management, SEO"
                        value={skillInput}
                        onChange={(e) => setSkillInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addSkill()}
                      />
                      <Button className="shrink-0 gap-2" onClick={addSkill}><Plus className="w-4 h-4" /> Add</Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-4">
                    {skills.map((skill) => (
                      <div key={skill} className="flex items-center gap-2 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-md text-sm">
                        {skill}
                        <button className="text-secondary-foreground/50 hover:text-destructive transition-colors" onClick={() => removeSkill(skill)}>
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-end gap-3">
              <Button variant="outline" className="gap-2" onClick={() => setActiveTab("preview")}>
                Preview Templates <ArrowRight className="w-4 h-4" />
              </Button>
              <Button className="gap-2" onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4" />
                {saving ? (isEditing ? "Updating…" : "Saving…") : finishLabel}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            {/* Template selector */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-base font-semibold mb-4">Choose a Template</h3>
                <TemplateSelector
                  selectedId={selectedTemplateId}
                  onSelect={handleTemplateSelect}
                  data={resumeContent}
                />
              </CardContent>
            </Card>

            {/* Export buttons */}
            <div className="flex gap-3 flex-wrap">
              <Button className="gap-2" onClick={handleDownloadPdf}>
                <Download className="w-4 h-4" /> Download PDF
              </Button>
              <Button variant="outline" className="gap-2" onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4" />
                {saving ? (isEditing ? "Updating…" : "Saving…") : saveLabel}
              </Button>
            </div>

            {/* Full-page preview at ~50% scale */}
            <div>
              <h3 className="text-base font-semibold mb-3">Full Page Preview</h3>
              <div
                style={{
                  width: `${PREVIEW_WIDTH}px`,
                  height: `${PREVIEW_HEIGHT}px`,
                  overflow: 'hidden',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: '794px',
                    transformOrigin: 'top left',
                    transform: `scale(${PREVIEW_SCALE})`,
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                >
                  <TemplateRenderer templateId={selectedTemplateId} data={resumeContent} />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
