import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Lock, Loader2, UserCircle, CheckCircle2, Download, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";

interface StatsData {
  creditsUsed: number;
  creditsLimit: number;
  isPro: boolean;
}

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  // Pre-fill form from user object
  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setPhone(user.phone ?? "");
    }
  }, [user]);

  // Fetch stats for credit usage
  useEffect(() => {
    if (!user) return;
    fetch("/api/stats", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, [user]);

  async function handleSave() {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Save failed" }));
        throw new Error(err.error ?? "Save failed");
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message ?? "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch('/api/auth/account', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        window.location.href = '/login';
      } else {
        setDeleting(false);
        setDeleteError('Failed to delete account. Please try again or contact support.');
      }
    } catch {
      setDeleting(false);
      setDeleteError('An error occurred. Please try again.');
    }
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

  const planLabel =
    user.lifetimeAccess ? "Lifetime" : user.plan === "pro" ? "Pro" : "Starter";

  const planBadgeClass =
    user.lifetimeAccess
      ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
      : user.plan === "pro"
      ? "bg-primary/10 text-primary border-primary/30"
      : "bg-muted text-muted-foreground border-border";

  const creditsUsed = stats?.creditsUsed ?? 0;
  const creditsLimit = stats?.creditsLimit ?? 5;
  const isPro = stats?.isPro ?? false;
  const creditPct = isPro ? 0 : Math.round((creditsUsed / creditsLimit) * 100);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto pb-20 space-y-6">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold mb-2 flex items-center gap-3">
            <UserCircle className="w-8 h-8 text-primary" />
            Profile
          </h1>
          <p className="text-muted-foreground">Manage your account details and subscription.</p>
        </div>

        {/* Account Info card */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle>Account Info</CardTitle>
            <CardDescription>Update your personal details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Email (read-only) */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted border border-border text-sm text-muted-foreground">
                <Lock className="w-4 h-4 shrink-0" />
                <span>{user.email}</span>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="profile-name">
                Name
              </label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
              />
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="profile-phone">
                Phone
              </label>
              <Input
                id="profile-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                type="tel"
              />
            </div>

            {/* Success / error messages */}
            {saveSuccess && (
              <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Changes saved successfully.
              </div>
            )}
            {saveError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {saveError}
              </div>
            )}

            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Plan & Usage card */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle>Plan &amp; Usage</CardTitle>
            <CardDescription>Your current subscription and AI credit usage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Current plan:</span>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${planBadgeClass}`}
              >
                {planLabel}
              </span>
            </div>

            {statsLoading ? (
              <div className="h-8 w-48 bg-muted rounded animate-pulse" />
            ) : isPro ? (
              <p className="text-sm text-green-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Unlimited AI generations
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">AI credits used this month</span>
                  <span className="font-medium">
                    {creditsUsed} / {creditsLimit}
                  </span>
                </div>
                <Progress value={creditPct} className="h-2" />
                {creditPct >= 100 && (
                  <p className="text-xs text-red-400">You've used all your credits for this month.</p>
                )}
              </div>
            )}

            {!isPro && (
              <Link href="/">
                <Button variant="outline" className="border-primary/20 hover:bg-primary/10 hover:text-primary gap-2">
                  Upgrade to Pro →
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Security card */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle>Security</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              To change your password, contact support.
            </p>
          </CardContent>
        </Card>

        {/* Data & Privacy card */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle>Data &amp; Privacy</CardTitle>
            <CardDescription>Manage your personal data in accordance with GDPR and privacy regulations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Export */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Export My Data</p>
              <p className="text-sm text-muted-foreground">
                Download a copy of all your data including your profile, resumes, and job applications.
              </p>
              <a href="/api/auth/export-data" target="_blank" rel="noreferrer">
                <Button variant="outline" className="flex items-center gap-2">
                  <Download className="w-4 h-4" /> Export My Data
                </Button>
              </a>
            </div>

            {/* Delete account */}
            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-sm font-medium text-destructive">Delete Account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data. This cannot be undone.
              </p>
              <Button
                variant="destructive"
                className="flex items-center gap-2"
                onClick={() => { setShowDeleteDialog(true); setDeleteError(null); }}
              >
                <Trash2 className="w-4 h-4" /> Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => { if (!deleting) setShowDeleteDialog(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete your profile, all resumes, and all job applications. This action cannot be undone.
          </p>
          {deleteError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {deleteError}
            </div>
          )}
          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="gap-2"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete My Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
