import Layout from "@/components/Layout";
import { useState } from "react";
import { ResumeUploader } from "@/components/ResumeUploader";
import { JobPostingInput } from "@/components/JobPostingInput";
import { ResumePreview } from "@/components/ResumePreview";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Loader2, Download, Copy, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Tailor() {
  const [step, setStep] = useState<"upload" | "input" | "processing" | "result">("upload");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const { toast } = useToast();

  const handleNext = () => {
    if (step === "upload" && resumeFile) {
      setStep("input");
    } else if (step === "input" && jobDescription) {
      processTailoring();
    }
  };

  const processTailoring = () => {
    setStep("processing");
    // Simulate AI processing
    setTimeout(() => {
      setStep("result");
      toast({
        title: "Resume Tailored!",
        description: "Your resume has been optimized for the job description.",
      });
    }, 3000);
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto h-full flex flex-col">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold mb-2">Tailor Resume</h1>
          <p className="text-muted-foreground">Optimize your resume for a specific job posting to increase your interview chances.</p>
          
          {/* Progress Steps */}
          <div className="flex items-center mt-6 gap-4 text-sm font-medium">
            <div className={`flex items-center gap-2 ${step === "upload" ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${step === "upload" ? "border-primary bg-primary/10" : "border-border"}`}>1</div>
              Upload
            </div>
            <div className="w-8 h-px bg-border" />
            <div className={`flex items-center gap-2 ${step === "input" ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${step === "input" ? "border-primary bg-primary/10" : "border-border"}`}>2</div>
              Job Details
            </div>
            <div className="w-8 h-px bg-border" />
            <div className={`flex items-center gap-2 ${step === "result" ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${step === "result" ? "border-primary bg-primary/10" : "border-border"}`}>3</div>
              Result
            </div>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0">
          {/* Left Panel */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {step === "upload" && (
              <div className="bg-card border border-border rounded-xl p-6 space-y-6 animate-in fade-in slide-in-from-left-4">
                <h2 className="text-lg font-semibold">Step 1: Your Resume</h2>
                <ResumeUploader onUpload={setResumeFile} />
                <div className="flex justify-end">
                  <Button onClick={handleNext} disabled={!resumeFile} className="gap-2">
                    Next Step <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {(step === "input" || step === "processing" || step === "result") && (
              <div className="bg-card border border-border rounded-xl p-6 h-full flex flex-col animate-in fade-in slide-in-from-left-4">
                <h2 className="text-lg font-semibold mb-4">
                  {step === "result" ? "Job Description Used" : "Step 2: Job Details"}
                </h2>
                <div className="flex-1 min-h-0">
                  <JobPostingInput 
                    value={jobDescription} 
                    onChange={setJobDescription} 
                  />
                </div>
                {step === "input" && (
                  <div className="flex justify-end mt-4">
                    <Button onClick={handleNext} disabled={!jobDescription} className="gap-2">
                      Generate Tailored Resume <Sparkles className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Panel / Preview */}
          <div className="lg:col-span-7 bg-muted/30 rounded-xl border border-border/50 p-6 flex items-center justify-center relative min-h-[600px]">
            {step === "processing" ? (
              <div className="text-center space-y-4 animate-in fade-in zoom-in duration-300">
                <div className="relative w-20 h-20 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-pulse" />
                  <div className="absolute inset-0 rounded-full border-t-4 border-primary animate-spin" />
                  <Sparkles className="w-8 h-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <h3 className="text-xl font-semibold font-display">Optimizing your profile...</h3>
                <p className="text-muted-foreground max-w-xs mx-auto">
                  Analyzing keywords, restructuring bullet points, and highlighting relevant experience.
                </p>
              </div>
            ) : step === "result" ? (
              <div className="w-full h-full flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-lg">Tailored Preview</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Copy className="w-4 h-4" /> Copy Text
                    </Button>
                    <Button size="sm" className="gap-2">
                      <Download className="w-4 h-4" /> Download PDF
                    </Button>
                  </div>
                </div>
                <ResumePreview />
              </div>
            ) : (
              <div className="text-center text-muted-foreground space-y-4 opacity-50">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                  <FileText className="w-8 h-8" />
                </div>
                <p>Preview will appear here after processing</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
