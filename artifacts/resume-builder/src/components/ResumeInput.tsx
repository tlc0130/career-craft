import { useState } from "react";
import { Upload, FileText, X, ClipboardList, BookOpen, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";

export type ResumeInputValue =
  | { mode: "file"; file: File }
  | { mode: "text"; text: string }
  | null;

interface SavedResume {
  id: string;
  title: string;
  jobTitle: string | null;
  content: string;
  updatedAt: string;
}

interface ResumeInputProps {
  value: ResumeInputValue;
  onChange: (value: ResumeInputValue) => void;
}

const INPUT_MODE_KEY = "resume-input-mode";

function getInitialMode(value: ResumeInputValue): "paste" | "upload" | "saved" {
  if (value?.mode === "file") return "upload";
  const saved = localStorage.getItem(INPUT_MODE_KEY);
  if (saved === "upload" || saved === "paste") return saved;
  return "paste";
}

export function ResumeInput({ value, onChange }: ResumeInputProps) {
  const { user } = useAuth();
  const [mode, setMode] = useState<"paste" | "upload" | "saved">(
    () => getInitialMode(value)
  );
  const [isDragging, setIsDragging] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: savedResumes = [] } = useQuery<SavedResume[]>({
    queryKey: ["resumes"],
    queryFn: async () => {
      const res = await fetch("/api/resumes", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const hasSavedResumes = savedResumes.length > 0;

  const switchMode = (next: "paste" | "upload" | "saved") => {
    setMode(next);
    if (next === "paste" || next === "upload") {
      localStorage.setItem(INPUT_MODE_KEY, next);
    }
    if (next !== "saved") {
      setSelectedResumeId(null);
    }
    onChange(null);
  };

  const validateAndSetFile = (file: File) => {
    if (file.type === "application/pdf" || file.type.includes("word")) {
      onChange({ mode: "file", file });
      toast({
        title: "Resume Uploaded",
        description: `${file.name} ready for processing.`,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Invalid File Type",
        description: "Please upload a PDF or Word document.",
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) validateAndSetFile(droppedFile);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) validateAndSetFile(selected);
    e.target.value = "";
  };

  const clearFile = () => onChange(null);

  const handleSelectSavedResume = (resume: SavedResume) => {
    setSelectedResumeId(resume.id);
    onChange({ mode: "text", text: resume.content });
  };

  const currentFile = value?.mode === "file" ? value.file : null;
  const currentText = value?.mode === "text" ? value.text : "";

  return (
    <div className="w-full space-y-3">
      {/* Toggle */}
      <div className="flex rounded-lg border border-border bg-muted/50 p-1 gap-1">
        <button
          type="button"
          onClick={() => switchMode("paste")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-sm font-medium transition-colors",
            mode === "paste"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ClipboardList className="w-4 h-4" />
          Paste Text
        </button>
        <button
          type="button"
          onClick={() => switchMode("upload")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-sm font-medium transition-colors",
            mode === "upload"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Upload className="w-4 h-4" />
          Upload File
        </button>
        {user && hasSavedResumes && (
          <button
            type="button"
            onClick={() => switchMode("saved")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-sm font-medium transition-colors",
              mode === "saved"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BookOpen className="w-4 h-4" />
            My Resumes
          </button>
        )}
      </div>

      {/* Paste mode */}
      {mode === "paste" && (
        <Textarea
          placeholder="Paste the full text of your resume here…"
          className="min-h-[180px] resize-none font-mono text-sm leading-relaxed"
          value={currentText}
          onChange={(e) =>
            onChange(
              e.target.value
                ? { mode: "text", text: e.target.value }
                : null
            )
          }
        />
      )}

      {/* Upload mode */}
      {mode === "upload" && (
        <>
          {!currentFile ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
              onClick={() =>
                document.getElementById("resume-input-upload")?.click()
              }
            >
              <input
                type="file"
                id="resume-input-upload"
                className="hidden"
                accept=".pdf,.doc,.docx"
                onChange={handleFileInput}
              />
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-6 h-6" />
              </div>
              <h3 className="font-display font-semibold text-lg mb-2">
                Upload your Resume
              </h3>
              <p className="text-muted-foreground text-sm">
                Drag and drop or click to browse (PDF, DOCX)
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground">
                    {currentFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(currentFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={clearFile}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* My Resumes mode */}
      {mode === "saved" && (
        <div className="space-y-2">
          {savedResumes.map((resume) => {
            const isSelected = selectedResumeId === resume.id;
            return (
              <button
                key={resume.id}
                type="button"
                onClick={() => handleSelectSavedResume(resume)}
                className={cn(
                  "w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">
                      {resume.title}
                    </p>
                    {resume.jobTitle && (
                      <p className="text-xs text-muted-foreground truncate">
                        {resume.jobTitle}
                      </p>
                    )}
                  </div>
                </div>
                {isSelected && (
                  <Check className="w-4 h-4 text-primary shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
