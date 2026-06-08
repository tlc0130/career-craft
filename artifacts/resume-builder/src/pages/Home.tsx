import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Plus, Sparkles, FileText, CheckCircle2, Target, Zap, ShieldCheck, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth, startCheckout } from "@/lib/auth";
import generatedImage from '@assets/generated_images/abstract_3d_documents_tailored_resume_concept.png';

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [checkoutLoading, setCheckoutLoading] = useState<"pro" | "lifetime" | null>(null);
  const [checkoutBanner, setCheckoutBanner] = useState<{ type: "success" | "cancel"; plan?: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    const plan = params.get("plan") ?? undefined;
    if (checkout === "success") {
      setCheckoutBanner({ type: "success", plan });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (checkout === "cancel") {
      setCheckoutBanner({ type: "cancel" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function handleCheckout(plan: "pro" | "lifetime") {
    if (!user) {
      navigate("/login");
      return;
    }
    setCheckoutLoading(plan);
    try {
      await startCheckout(plan);
    } catch (err: any) {
      alert(err.message ?? "Checkout failed. Please try again.");
    } finally {
      setCheckoutLoading(null);
    }
  }

  const hasPro = user?.plan === "pro" || user?.lifetimeAccess;
  const hasLifetime = user?.lifetimeAccess;

  return (
    <Layout>
      <div className="space-y-16 pb-12">
        {/* Checkout result banner */}
        {checkoutBanner && (
          <div
            className={`flex items-center justify-between gap-4 rounded-xl border px-5 py-4 text-sm font-medium ${
              checkoutBanner.type === "success"
                ? "border-green-500/30 bg-green-500/10 text-green-400"
                : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
            }`}
          >
            <div className="flex items-center gap-3">
              {checkoutBanner.type === "success" ? (
                <>
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <span>
                    {checkoutBanner.plan === "lifetime"
                      ? "🎉 Lifetime access unlocked! All Pro features are yours forever."
                      : "🎉 You're now on the Pro plan! Unlimited tailoring and cover letters are ready."}
                    {!authLoading && !user && " Please log in to see your updated plan."}
                  </span>
                </>
              ) : (
                <>
                  <X className="h-5 w-5 shrink-0" />
                  <span>Checkout was cancelled — no charge was made. You can upgrade any time.</span>
                </>
              )}
            </div>
            <button
              onClick={() => setCheckoutBanner(null)}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <Sparkles className="mr-2 h-4 w-4" />
              Powered by Advanced AI
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold tracking-tight text-foreground leading-[1.1]">
              Land your dream job with <span className="text-primary">AI-tailored</span> resumes.
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl">
              Stop sending generic resumes. Career Craft analyzes job descriptions and optimizes your resume to pass ATS filters and impress recruiters.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <Link href="/tailor">
                <Button size="lg" className="gap-2 shadow-lg shadow-primary/25 h-12 px-6 text-base">
                  <Sparkles className="w-5 h-5" />
                  Tailor Resume Now
                </Button>
              </Link>
              <Link href="/builder">
                <Button size="lg" variant="outline" className="gap-2 h-12 px-6 text-base border-primary/20 hover:bg-primary/5 text-primary">
                  <Plus className="w-5 h-5" />
                  Create from Scratch
                </Button>
              </Link>
            </div>
          </div>
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-primary/20 animate-float aspect-video lg:aspect-square">
            <img
              src={generatedImage}
              alt="Abstract 3D Resume Concept"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-background/20 to-transparent pointer-events-none" />
            <div className="absolute bottom-6 left-6 right-6 p-4 rounded-xl bg-background/80 backdrop-blur-md border border-white/10 shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                  <Target className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-white">Keyword-matched to the job</p>
                  <p className="text-xs text-white/70 mt-1">Your experience, aligned to what the posting asks for.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="py-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-display font-bold mb-4">How Career Craft Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Three simple steps to significantly increase your interview chances using our intelligent tailoring engine.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-border -z-10" />
            {[
              { step: "01", title: "Upload Resume", description: "Start by uploading your existing resume in PDF or Word format, or build one from scratch.", icon: FileText },
              { step: "02", title: "Paste Job Description", description: "Provide the exact job posting you're applying for. We'll analyze the required skills and keywords.", icon: Target },
              { step: "03", title: "Get Tailored Results", description: "Our AI highlights your matching experience and generates an ATS-optimized resume instantly.", icon: Zap },
            ].map((item, i) => (
              <div key={i} className="relative flex flex-col items-center text-center group">
                <div className="w-24 h-24 rounded-2xl bg-card border-2 border-border flex items-center justify-center mb-6 shadow-sm group-hover:border-primary group-hover:shadow-primary/20 transition-all duration-300 relative z-10">
                  <item.icon className="w-10 h-10 text-primary" />
                  <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-md">
                    {item.step}
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-2 font-display">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8">
          <Card className="bg-card border-border/50 hover:border-primary/50 transition-all shadow-sm">
            <CardHeader>
              <ShieldCheck className="w-10 h-10 text-primary mb-4" />
              <CardTitle className="text-2xl">ATS Optimization</CardTitle>
              <CardDescription className="text-base text-muted-foreground/80">Beat the Applicant Tracking Systems</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                We format your resume exactly how automated systems want to read it, ensuring your application actually reaches human eyes instead of being automatically filtered out.
              </p>
              <ul className="mt-4 space-y-2">
                {['Keyword matching', 'Format standardisation', 'Action verb highlighting'].map((feature, idx) => (
                  <li key={idx} className="flex items-center text-sm text-foreground/80">
                    <CheckCircle2 className="w-4 h-4 text-primary mr-2" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50 hover:border-primary/50 transition-all shadow-sm">
            <CardHeader>
              <FileText className="w-10 h-10 text-primary mb-4" />
              <CardTitle className="text-2xl">Custom Cover Letters</CardTitle>
              <CardDescription className="text-base text-muted-foreground/80">Persuasive writing tailored to the role</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Generate highly personalized cover letters that weave your existing experience into a compelling narrative perfectly aligned with the target company's needs.
              </p>
              <ul className="mt-4 space-y-2">
                {['Tone matching', 'Experience weaving', 'Instant generation'].map((feature, idx) => (
                  <li key={idx} className="flex items-center text-sm text-foreground/80">
                    <CheckCircle2 className="w-4 h-4 text-primary mr-2" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Pricing Section */}
        <div className="py-16 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-[400px] bg-primary/10 blur-[100px] rounded-full pointer-events-none -z-10" />
          <div className="text-center mb-12">
            <h2 className="text-3xl font-display font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Choose the plan that fits your job search. No hidden fees, cancel anytime.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Tier */}
            <Card className="bg-card/50 border-border flex flex-col">
              <CardHeader>
                <CardTitle className="text-2xl">Starter</CardTitle>
                <CardDescription>Perfect for a quick update</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold font-display">$0</span>
                  <span className="text-muted-foreground">/forever</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-3">
                  {['1 Resume tailoring', 'Basic ATS scan', 'Download as PDF'].map((f) => (
                    <li key={f} className="flex items-start text-sm">
                      <CheckCircle2 className="w-5 h-5 text-muted-foreground mr-2 shrink-0" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {user ? (
                  <Button variant="outline" className="w-full" disabled>
                    {user.plan === "starter" ? "Current Plan" : "Free Tier"}
                  </Button>
                ) : (
                  <Link href="/login" className="w-full">
                    <Button variant="outline" className="w-full">Get Started</Button>
                  </Link>
                )}
              </CardFooter>
            </Card>

            {/* Pro Tier */}
            <Card className="bg-card border-primary shadow-xl shadow-primary/10 relative flex flex-col scale-105 z-10">
              <div className="absolute -top-3 left-0 right-0 flex justify-center">
                <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Most Popular
                </span>
              </div>
              <CardHeader>
                <CardTitle className="text-2xl text-primary">Pro Searcher</CardTitle>
                <CardDescription>For active job hunters</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold font-display text-foreground">$20</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-3">
                  {['Unlimited resume tailoring', 'Unlimited cover letters', 'Deep ATS keyword matching', 'Job tracker dashboard'].map((f) => (
                    <li key={f} className="flex items-start text-sm">
                      <CheckCircle2 className="w-5 h-5 text-primary mr-2 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {hasPro ? (
                  <Button className="w-full" disabled>
                    {hasLifetime ? "Lifetime Access" : "Current Plan"}
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => handleCheckout("pro")}
                    disabled={checkoutLoading === "pro"}
                  >
                    {checkoutLoading === "pro" ? "Loading…" : "Subscribe Now"}
                  </Button>
                )}
              </CardFooter>
            </Card>

            {/* Lifetime Tier */}
            <Card className="bg-card/50 border-border flex flex-col">
              <CardHeader>
                <CardTitle className="text-2xl">Lifetime</CardTitle>
                <CardDescription>Buy once, use forever</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold font-display">$149.99</span>
                  <span className="text-muted-foreground">/one-time</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-3">
                  {['All Pro features', 'Never pay monthly fees', 'Access to future updates'].map((f) => (
                    <li key={f} className="flex items-start text-sm">
                      <CheckCircle2 className="w-5 h-5 text-primary mr-2 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {hasLifetime ? (
                  <Button variant="outline" className="w-full" disabled>
                    ✓ You have Lifetime Access
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleCheckout("lifetime")}
                    disabled={checkoutLoading === "lifetime"}
                  >
                    {checkoutLoading === "lifetime" ? "Loading…" : "Get Lifetime Access"}
                  </Button>
                )}
              </CardFooter>
            </Card>
          </div>
        </div>

        {/* Why It Works */}
        <div className="py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-display font-bold mb-4">Why It Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">A focused workflow that turns a generic resume into a role-specific application.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: "Matches the posting", body: "The AI reads the job description and surfaces the experience and keywords that role actually calls for." },
              { title: "Keeps it truthful", body: "It reorders and rephrases what's already on your resume — it never invents experience you don't have." },
              { title: "Saves real time", body: "Tailor a resume or draft a cover letter in minutes, then export a clean DOCX or PDF ready to send." },
            ].map((item, i) => (
              <Card key={i} className="bg-card border-border/50">
                <CardContent className="pt-6">
                  <CheckCircle2 className="w-8 h-8 text-primary mb-4" />
                  <p className="font-semibold text-foreground mb-2">{item.title}</p>
                  <p className="text-muted-foreground">{item.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-primary/10 border border-primary/20 rounded-3xl p-8 md:p-16 text-center relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-secondary/20 rounded-full blur-3xl" />
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4 relative z-10">Ready to upgrade your career?</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto relative z-10">Tailor your resume to each role in minutes — not hours — and apply with confidence.</p>
          <Link href="/tailor">
            <Button size="lg" className="h-14 px-8 text-lg gap-2 shadow-lg shadow-primary/20 relative z-10 text-primary-foreground">
              <Sparkles className="w-5 h-5" />
              Start Tailoring for Free
            </Button>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
