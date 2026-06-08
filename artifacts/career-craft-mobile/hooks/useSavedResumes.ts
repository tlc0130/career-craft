import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/context/AuthContext";

export interface SavedResume {
  id: string;
  title: string;
  jobTitle: string | null;
  content: unknown;
  createdAt: string;
  updatedAt: string;
}

export function extractResumeText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (content && typeof content === "object") {
    const c = content as Record<string, unknown>;
    if (typeof c["text"] === "string") return c["text"];
    if (typeof c["content"] === "string") return c["content"];
    if (typeof c["resume"] === "string") return c["resume"];
  }
  return null;
}

export function useSavedResumes(enabled: boolean) {
  const [resumes, setResumes] = useState<SavedResume[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/resumes");
      if (!res.ok) {
        setError("Could not load resumes");
        return;
      }
      const data = (await res.json()) as SavedResume[];
      setResumes(data);
    } catch {
      setError("Could not load resumes");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { resumes, loading, error, refresh: fetch };
}
