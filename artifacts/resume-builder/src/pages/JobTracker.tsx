import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Briefcase,
  Plus,
  Crown,
  Loader2,
  ExternalLink,
  Trash2,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface JobApplication {
  id: string;
  company: string;
  jobTitle: string;
  jobUrl?: string;
  status: "saved" | "applied" | "phone_screen" | "interview" | "offer" | "rejected" | "withdrawn";
  notes?: string;
  appliedAt?: string;
  createdAt: string;
  updatedAt: string;
  salary?: number;
  contactName?: string;
  contactEmail?: string;
  followUpDate?: string;
}

type Status = JobApplication["status"];

const STATUSES: { key: Status; label: string; color: string; badgeClass: string; borderClass: string; headerClass: string }[] = [
  {
    key: "saved",
    label: "Saved",
    color: "slate",
    badgeClass: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    borderClass: "border-slate-500/30",
    headerClass: "bg-slate-500/10 text-slate-300",
  },
  {
    key: "applied",
    label: "Applied",
    color: "blue",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    borderClass: "border-blue-500/30",
    headerClass: "bg-blue-500/10 text-blue-300",
  },
  {
    key: "phone_screen",
    label: "Phone Screen",
    color: "purple",
    badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    borderClass: "border-purple-500/30",
    headerClass: "bg-purple-500/10 text-purple-300",
  },
  {
    key: "interview",
    label: "Interview",
    color: "amber",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    borderClass: "border-amber-500/30",
    headerClass: "bg-amber-500/10 text-amber-300",
  },
  {
    key: "offer",
    label: "Offer",
    color: "green",
    badgeClass: "bg-green-500/10 text-green-400 border-green-500/20",
    borderClass: "border-green-500/30",
    headerClass: "bg-green-500/10 text-green-300",
  },
  {
    key: "rejected",
    label: "Rejected",
    color: "red",
    badgeClass: "bg-red-500/10 text-red-400 border-red-500/20",
    borderClass: "border-red-500/30",
    headerClass: "bg-red-500/10 text-red-300",
  },
  {
    key: "withdrawn",
    label: "Withdrawn",
    color: "gray",
    badgeClass: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    borderClass: "border-gray-500/20",
    headerClass: "bg-gray-500/10 text-gray-400",
  },
];

const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.key, s])) as Record<
  Status,
  (typeof STATUSES)[number]
>;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const EMPTY_FORM = {
  company: "",
  jobTitle: "",
  jobUrl: "",
  status: "saved" as Status,
  notes: "",
  appliedAt: "",
  salary: "",
  contactName: "",
  contactEmail: "",
  followUpDate: "",
};

export default function JobTracker() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobApplication | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [showMoreDetails, setShowMoreDetails] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login");
      return;
    }
    fetchJobs();
  }, [user, authLoading]);

  async function fetchJobs() {
    setLoading(true);
    try {
      const res = await fetch("/api/jobs", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load job applications");
      setJobs(await res.json());
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "Could not load applications.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function openAddDialog() {
    setEditingJob(null);
    setForm({ ...EMPTY_FORM });
    setShowMoreDetails(false);
    setDialogOpen(true);
  }

  function openEditDialog(job: JobApplication) {
    setEditingJob(job);
    setForm({
      company: job.company,
      jobTitle: job.jobTitle,
      jobUrl: job.jobUrl ?? "",
      status: job.status,
      notes: job.notes ?? "",
      appliedAt: job.appliedAt ? job.appliedAt.slice(0, 10) : "",
      salary: job.salary != null ? String(job.salary) : "",
      contactName: job.contactName ?? "",
      contactEmail: job.contactEmail ?? "",
      followUpDate: job.followUpDate ? job.followUpDate.slice(0, 10) : "",
    });
    const hasExtra = !!(job.salary || job.contactName || job.contactEmail || job.followUpDate);
    setShowMoreDetails(hasExtra);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingJob(null);
    setForm({ ...EMPTY_FORM });
    setShowMoreDetails(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company.trim() || !form.jobTitle.trim()) return;

    setSubmitting(true);
    try {
      const payload: Record<string, string | number> = {
        company: form.company.trim(),
        jobTitle: form.jobTitle.trim(),
        status: form.status,
      };
      if (form.jobUrl.trim()) payload.jobUrl = form.jobUrl.trim();
      if (form.notes.trim()) payload.notes = form.notes.trim();
      if (form.appliedAt) payload.appliedAt = new Date(form.appliedAt).toISOString();
      if (form.salary.trim()) payload.salary = parseInt(form.salary.trim(), 10);
      if (form.contactName.trim()) payload.contactName = form.contactName.trim();
      if (form.contactEmail.trim()) payload.contactEmail = form.contactEmail.trim();
      if (form.followUpDate) payload.followUpDate = new Date(form.followUpDate).toISOString();

      if (editingJob) {
        const res = await fetch(`/api/jobs/${editingJob.id}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update application");
        const updated: JobApplication = await res.json();
        setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
        toast({ title: "Application updated" });
      } else {
        const res = await fetch("/api/jobs", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to create application");
        const created: JobApplication = await res.json();
        setJobs((prev) => [created, ...prev]);
        toast({ title: "Application added" });
      }
      closeDialog();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(job: JobApplication, newStatus: Status) {
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      const updated: JobApplication = await res.json();
      setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function handleDelete(job: JobApplication) {
    if (!confirm(`Delete "${job.company} — ${job.jobTitle}"? This cannot be undone.`)) return;
    setDeletingId(job.id);
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete application");
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
      toast({ title: "Application deleted" });
      if (editingJob?.id === job.id) closeDialog();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  const isPro = user?.plan === "pro" || user?.lifetimeAccess;

  const jobsByStatus = Object.fromEntries(
    STATUSES.map((s) => [s.key, jobs.filter((j) => j.status === s.key)])
  ) as Record<Status, JobApplication[]>;

  return (
    <Layout>
      <div className="pb-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold mb-2 flex items-center gap-3">
              <Briefcase className="w-8 h-8 text-primary" />
              Job Tracker
            </h1>
            <p className="text-muted-foreground">
              Track your job applications from saved to offer in one place.
            </p>
          </div>
          <Button className="gap-2" onClick={openAddDialog}>
            <Plus className="w-4 h-4" /> Add Application
          </Button>
        </div>

        {/* Pro upgrade banner for starter users */}
        {!isPro && (
          <div className="mb-6 p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5 text-sm text-muted-foreground flex items-center gap-3">
            <Crown className="w-5 h-5 text-yellow-500 shrink-0" />
            <span>
              Job Tracker is a Pro feature — you can still use it, but{" "}
              <a href="/#pricing" className="text-primary underline">
                upgrading to Pro
              </a>{" "}
              unlocks unlimited applications and advanced tracking.
            </span>
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
          {/* Pipeline stats bar */}
          {jobs.length > 0 && (
            <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                {(["saved", "applied", "phone_screen", "interview", "offer"] as const).map((key, idx, arr) => {
                  const statusDef = STATUS_MAP[key];
                  const count = jobsByStatus[key].length;
                  return (
                    <span key={key} className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusDef.badgeClass}`}>
                        {statusDef.label} ({count})
                      </span>
                      {idx < arr.length - 1 && (
                        <span className="text-muted-foreground text-sm">→</span>
                      )}
                    </span>
                  );
                })}
              </div>
              {jobsByStatus.rejected.length > 0 && (
                <span className="text-xs text-muted-foreground">{jobsByStatus.rejected.length} Rejected</span>
              )}
            </div>
          )}

          {/* Kanban board */}
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {STATUSES.map((statusDef) => {
                const columnJobs = jobsByStatus[statusDef.key];
                return (
                  <div key={statusDef.key} className="w-64 flex flex-col gap-3 shrink-0">
                    {/* Column header */}
                    <div
                      className={`flex items-center justify-between px-3 py-2 rounded-lg ${statusDef.headerClass}`}
                    >
                      <span className="font-semibold text-sm">{statusDef.label}</span>
                      <span className="text-xs font-medium opacity-70">{columnJobs.length}</span>
                    </div>

                    {/* Cards */}
                    <div className="flex flex-col gap-2 min-h-[120px]">
                      {columnJobs.length === 0 ? (
                        <div
                          className={`rounded-lg border-2 border-dashed ${statusDef.borderClass} p-4 text-center text-xs text-muted-foreground opacity-50`}
                        >
                          No applications here yet
                        </div>
                      ) : (
                        columnJobs.map((job) => (
                          <Card
                            key={job.id}
                            className="bg-card border-border/50 hover:border-primary/30 transition-all cursor-pointer group"
                            onClick={() => openEditDialog(job)}
                          >
                            <CardContent className="p-3 space-y-2">
                              <div className="flex items-start justify-between gap-1">
                                <div className="min-w-0">
                                  <p className="font-semibold text-sm truncate leading-tight">
                                    {job.company}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                                    {job.jobTitle}
                                  </p>
                                </div>
                                {job.jobUrl && (
                                  <a
                                    href={job.jobUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-muted-foreground hover:text-primary shrink-0 mt-0.5"
                                    title="Open job posting"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>

                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="w-3 h-3 shrink-0" />
                                <span>
                                  {job.appliedAt
                                    ? `Applied ${formatDate(job.appliedAt)}`
                                    : `Saved ${formatDate(job.createdAt)}`}
                                </span>
                              </div>

                              {/* Salary / follow-up */}
                              {(job.salary || (job.followUpDate && new Date(job.followUpDate) > new Date())) && (
                                <div className="flex items-center gap-2 flex-wrap">
                                  {job.salary && (
                                    <span className="text-xs text-muted-foreground">
                                      ${Math.round(job.salary / 1000)}k/yr
                                    </span>
                                  )}
                                  {job.followUpDate && new Date(job.followUpDate) > new Date() && (
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Calendar className="w-3 h-3 shrink-0" />
                                      {formatDate(job.followUpDate)}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Quick status change */}
                              <div
                                className="pt-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Select
                                  value={job.status}
                                  onValueChange={(val) =>
                                    handleStatusChange(job, val as Status)
                                  }
                                >
                                  <SelectTrigger className="h-7 text-xs px-2 py-0">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {STATUSES.map((s) => (
                                      <SelectItem key={s.key} value={s.key} className="text-xs">
                                        {s.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          </>
        )}

        {/* Add / Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingJob ? "Edit Application" : "Add Application"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company">Company *</Label>
                <Input
                  id="company"
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="e.g. Acme Corp"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="jobTitle">Job Title *</Label>
                <Input
                  id="jobTitle"
                  value={form.jobTitle}
                  onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
                  placeholder="e.g. Senior Engineer"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="jobUrl">Job URL</Label>
                <Input
                  id="jobUrl"
                  type="url"
                  value={form.jobUrl}
                  onChange={(e) => setForm((f) => ({ ...f, jobUrl: e.target.value }))}
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(val) => setForm((f) => ({ ...f, status: val as Status }))}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="appliedAt">Applied Date</Label>
                <Input
                  id="appliedAt"
                  type="date"
                  value={form.appliedAt}
                  onChange={(e) => setForm((f) => ({ ...f, appliedAt: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Recruiter name, interview notes, follow-up dates…"
                  rows={3}
                />
              </div>

              {/* Additional Details toggle */}
              <div>
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  onClick={() => setShowMoreDetails((v) => !v)}
                >
                  {showMoreDetails ? "Show Less ▲" : "Show More ▼"}
                </button>
                {showMoreDetails && (
                  <div className="mt-3 space-y-3 border-t border-border pt-3">
                    <div className="space-y-2">
                      <Label htmlFor="salary">Expected Salary (USD/year)</Label>
                      <Input
                        id="salary"
                        type="number"
                        placeholder="85000"
                        value={form.salary}
                        onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactName">Contact Name</Label>
                      <Input
                        id="contactName"
                        placeholder="Jane Smith (Recruiter)"
                        value={form.contactName}
                        onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactEmail">Contact Email</Label>
                      <Input
                        id="contactEmail"
                        type="email"
                        placeholder="recruiter@company.com"
                        value={form.contactEmail}
                        onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="followUpDate">Follow-up Date</Label>
                      <Input
                        id="followUpDate"
                        type="date"
                        value={form.followUpDate}
                        onChange={(e) => setForm((f) => ({ ...f, followUpDate: e.target.value }))}
                      />
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 pt-2">
                {editingJob && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 mr-auto"
                    onClick={() => handleDelete(editingJob)}
                    disabled={deletingId === editingJob.id}
                  >
                    {deletingId === editingJob.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    <span className="ml-2">Delete</span>
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !form.company.trim() || !form.jobTitle.trim()}
                  className="gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingJob ? "Save Changes" : "Add Application"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
