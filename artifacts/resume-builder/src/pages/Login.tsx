import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import logoUrl from '@assets/hiddentech_logo_1024x576_1777502981816.png';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_denied: "Google sign-in was cancelled.",
  oauth_failed: "Google sign-in failed. Please try again.",
  oauth_state: "Sign-in session expired. Please try again.",
};

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const [, navigate] = useLocation();

  const oauthErrorKey = new URLSearchParams(window.location.search).get("error") ?? "";
  const oauthError = OAUTH_ERROR_MESSAGES[oauthErrorKey] ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password);
      }
      navigate("/");
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
      <div className="absolute top-8 left-8">
        <Link href="/">
          <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Button>
        </Link>
      </div>

      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        <div className="flex flex-col items-center mb-8 text-center">
          <img src={logoUrl} alt="Hidden Tech Daily" className="h-16 w-auto mb-4 rounded object-contain" />
          <h1 className="font-display font-bold text-2xl tracking-tight leading-none mb-2">Career Craft</h1>
          <p className="text-muted-foreground">
            {mode === "login" ? "Welcome back. Please sign in to your account." : "Create your free account to get started."}
          </p>
        </div>

        <Card className="border-border/50 shadow-xl shadow-primary/5 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>{mode === "login" ? "Sign In" : "Create Account"}</CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Enter your email and password to access your tailored resumes."
                : "Enter your email and a password to create your account."}
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-0">
            {oauthError && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 mb-4">
                {oauthError}
              </div>
            )}
            {/* Google OAuth button */}
            <a href="/api/auth/google" className="block w-full">
              <Button variant="outline" className="w-full flex items-center gap-2" type="button">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </Button>
            </a>
            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>
          </CardContent>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 pt-0">
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  className="bg-background/50"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  className="bg-background/50"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={mode === "register" ? 8 : 1}
                />
                {mode === "register" && (
                  <p className="text-xs text-muted-foreground">Must be at least 8 characters.</p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full h-12 text-base font-medium mt-6 shadow-lg shadow-primary/20"
                disabled={loading}
              >
                {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
              </Button>
            </CardContent>
          </form>
          <CardFooter className="flex justify-center border-t border-border/50 pt-6">
            <p className="text-sm text-muted-foreground">
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                className="text-primary font-medium hover:underline cursor-pointer"
                onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              >
                {mode === "login" ? "Sign up for free" : "Sign in"}
              </button>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
