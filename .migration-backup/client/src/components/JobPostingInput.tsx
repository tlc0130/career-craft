import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface JobPostingInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function JobPostingInput({ value, onChange }: JobPostingInputProps) {
  return (
    <div className="space-y-2 h-full flex flex-col">
      <Label htmlFor="job-posting" className="text-base font-medium">
        Job Description
      </Label>
      <Textarea
        id="job-posting"
        placeholder="Paste the full job description here. We'll analyze keywords and requirements..."
        className="flex-1 min-h-[200px] resize-none font-mono text-sm bg-card/50 focus:bg-card transition-colors"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">
        Tip: Include the "Responsibilities" and "Qualifications" sections for best results.
      </p>
    </div>
  );
}
