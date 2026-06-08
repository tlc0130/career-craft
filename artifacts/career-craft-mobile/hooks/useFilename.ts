function sanitizeFilePart(s: string): string {
  return s
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40)
    .trim();
}

export function extractJobContext(jobDescription: string): { company?: string; title?: string } {
  const text = jobDescription.slice(0, 3000);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let company: string | undefined;
  let title: string | undefined;

  for (const line of lines) {
    if (!company) {
      const m = line.match(/^(?:company|organization|employer|hiring company)[:\s\u2013\u2014-]+(.+)$/i);
      if (m) company = sanitizeFilePart(m[1]);
    }
    if (!title) {
      const m = line.match(/^(?:job title|position|role|title)[:\s\u2013\u2014-]+(.+)$/i);
      if (m) title = sanitizeFilePart(m[1]);
    }
    if (company && title) break;
  }

  if (!company) {
    const m = text.match(/\bat\s+([A-Z][A-Za-z0-9&.\s,'-]{2,39}?)(?=\s*[,.()\n]|$)/m);
    if (m) company = sanitizeFilePart(m[1]);
  }

  if (!title) {
    const m = text.match(
      /(?:hiring|seeking|looking for)\s+(?:a|an)\s+([A-Z][A-Za-z\s/&-]{3,49}?)(?=\s+(?:to|at|who|with)|[,.\n]|$)/i
    );
    if (m) title = sanitizeFilePart(m[1]);
  }

  return { company, title };
}

export function buildFilename(prefix: string, ext: string, jobDescription: string): string {
  const { company, title } = extractJobContext(jobDescription);
  const parts = [company, title].filter(Boolean);
  if (parts.length === 0) return `${prefix}.${ext}`;
  return `${prefix} \u2013 ${parts.join(" ")}.${ext}`;
}
