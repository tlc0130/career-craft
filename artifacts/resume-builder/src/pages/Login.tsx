import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import logoUrl from '@assets/hiddentech_logo_1024x576_1777502981816.png';

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const [, navigate] = useLocation();

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
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
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
