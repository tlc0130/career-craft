import { useState } from "react";
import { Upload, FileText, X, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ResumeUploaderProps {
  onUpload: (file: File | null) => void;
}

export function ResumeUploader({ onUpload }: ResumeUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    validateAndSetFile(droppedFile);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const validateAndSetFile = (file: File) => {
    if (file.type === "application/pdf" || file.type.includes("word")) {
      setFile(file);
      onUpload(file);
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

  const clearFile = () => {
    setFile(null);
    onUpload(null);
  };

  return (
    <div className="w-full">
      {!file ? (
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
          onClick={() => document.getElementById("resume-upload")?.click()}
        >
          <input
            type="file"
            id="resume-upload"
            className="hidden"
            accept=".pdf,.doc,.docx"
            onChange={handleFileInput}
          />
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <Upload className="w-6 h-6" />
          </div>
          <h3 className="font-display font-semibold text-lg mb-2">Upload your Resume</h3>
          <p className="text-muted-foreground text-sm mb-4">
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
              <p className="font-medium text-sm text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={clearFile} className="text-muted-foreground hover:text-destructive">
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
