import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Link } from "lucide-react";

interface JobPostingInputProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export function JobPostingInput({ value, onChange, readOnly = false }: JobPostingInputProps) {
  const [url, setUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState("");

  async function handleScrape() {
    if (!url.trim()) return;
    setScraping(true);
    setScrapeError("");
    try {
      const res = await fetch("/api/ai/scrape-job", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch URL");
      onChange(data.text);
    } catch (err: any) {
      setScrapeError(err.message ?? "Failed to fetch URL");
    } finally {
      setScraping(false);
    }
  }

  if (readOnly) {
    return (
      <div className="space-y-2 h-full flex flex-col">
        <Label className="text-base font-medium">Job Description</Label>
        <Textarea
          className="flex-1 min-h-[200px] resize-none font-mono text-sm bg-card/50"
          value={value}
          readOnly
        />
      </div>
    );
  }

  return (
    <div className="space-y-2 h-full flex flex-col">
      <Label className="text-base font-medium">Job Description</Label>
      <Tabs defaultValue="paste" className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-fit mb-2 shrink-0">
          <TabsTrigger value="paste">Paste Text</TabsTrigger>
          <TabsTrigger value="url">From URL</TabsTrigger>
        </TabsList>

        <TabsContent value="paste" className="flex-1 flex flex-col mt-0 min-h-0">
          <Textarea
            placeholder="Paste the full job description here. We'll analyze keywords and requirements..."
            className="flex-1 min-h-[200px] resize-none font-mono text-sm bg-card/50 focus:bg-card transition-colors"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </TabsContent>

        <TabsContent value="url" className="flex flex-col gap-3 mt-0 min-h-0">
          <div className="flex gap-2 shrink-0">
            <Input
              placeholder="https://jobs.example.com/posting..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !scraping && handleScrape()}
              className="flex-1"
            />
            <Button
              onClick={handleScrape}
              disabled={scraping || !url.trim()}
              className="gap-2 shrink-0"
            >
              {scraping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
              {scraping ? "Fetching…" : "Fetch"}
            </Button>
          </div>
          {scrapeError && (
            <p className="text-xs text-destructive shrink-0">{scrapeError}</p>
          )}
          {value ? (
            <Textarea
              placeholder="Fetched job description…"
              className="flex-1 min-h-[160px] resize-none font-mono text-sm bg-card/50 focus:bg-card transition-colors"
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          ) : (
            <div className="flex-1 min-h-[160px] border rounded-md bg-muted/30 flex items-center justify-center">
              <p className="text-sm text-muted-foreground px-4 text-center">
                {scraping ? "Fetching job description…" : "Enter a job posting URL above and click Fetch"}
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
      <p className="text-xs text-muted-foreground shrink-0">
        Tip: Include the "Responsibilities" and "Qualifications" sections for best results.
      </p>
    </div>
  );
}
