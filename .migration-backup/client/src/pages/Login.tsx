import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft, Wand2 } from "lucide-react";
import logoUrl from '@assets/hiddentech_logo_1024x576_1777502981816.png';

export default function Login() {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
      {/* Back button */}
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
          <p className="text-muted-foreground">Welcome back. Please sign in to your account.</p>
        </div>

        <Card className="border-border/50 shadow-xl shadow-primary/5 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Enter your email and password to access your tailored resumes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="name@example.com" className="bg-background/50" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password">
                  <span className="text-xs text-primary hover:underline cursor-pointer">Forgot password?</span>
                </Link>
              </div>
              <Input id="password" type="password" className="bg-background/50" />
            </div>
            <Button className="w-full h-12 text-base font-medium mt-6 shadow-lg shadow-primary/20">
              Sign In
            </Button>
            
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <Button variant="outline" className="w-full h-12 bg-background/50">
              <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
              </svg>
              Google
            </Button>
          </CardContent>
          <CardFooter className="flex justify-center border-t border-border/50 pt-6">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <span className="text-primary font-medium hover:underline cursor-pointer">Sign up for free</span>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}