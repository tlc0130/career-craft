import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  convertInchesToTwip,
} from "docx";
import { jsPDF } from "jspdf";

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
      const m = line.match(/^(?:company|organization|employer|hiring company)[:\s–—-]+(.+)$/i);
      if (m) company = sanitizeFilePart(m[1]);
    }
    if (!title) {
      const m = line.match(/^(?:job title|position|role|title)[:\s–—-]+(.+)$/i);
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

export function buildFilename(
  prefix: string,
  ext: string,
  jobDescription: string,
  aiContext?: { company?: string | null; title?: string | null }
): string {
  const { company, title } = aiContext
    ? {
        company: aiContext.company ?? extractJobContext(jobDescription).company,
        title: aiContext.title ?? extractJobContext(jobDescription).title,
      }
    : extractJobContext(jobDescription);
  const parts = [company, title].filter(Boolean);
  if (parts.length === 0) return `${prefix}.${ext}`;
  return `${prefix} – ${parts.join(" ")}.${ext}`;
}

function saveDocx(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseLines(text: string): string[] {
  return text.split(/\r?\n/);
}

// Strip Markdown syntax to get plain text
function stripMarkdown(text: string): string {
  return text
    .replace(/\*{1,3}([^*]*)\*{1,3}/g, "$1")
    .replace(/^#{1,6}\s+/, "")
    .replace(/`([^`]*)`/g, "$1")
    .trim();
}

// Parse inline Markdown into Word TextRun array
function parseInline(text: string, size = 20, font = "Calibri"): TextRun[] {
  const runs: TextRun[] = [];
  // Match ***bold-italic***, **bold**, *italic*, `code` in order
  const regex = /(\*{3}(?:[^*]|\*(?!\*))*?\*{3}|\*{2}(?:[^*]|\*(?!\*))*?\*{2}|\*(?:[^*\n])*?\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const plain = text.slice(lastIndex, match.index);
      if (plain) runs.push(new TextRun({ text: plain, size, font }));
    }
    const m = match[0];
    if (m.startsWith("***") && m.endsWith("***")) {
      runs.push(new TextRun({ text: m.slice(3, -3), bold: true, italics: true, size, font }));
    } else if (m.startsWith("**") && m.endsWith("**")) {
      runs.push(new TextRun({ text: m.slice(2, -2), bold: true, size, font }));
    } else if (m.startsWith("*") && m.endsWith("*")) {
      runs.push(new TextRun({ text: m.slice(1, -1), italics: true, size, font }));
    } else if (m.startsWith("`") && m.endsWith("`")) {
      runs.push(new TextRun({ text: m.slice(1, -1), size, font: "Courier New" }));
    }
    lastIndex = match.index + m.length;
  }
  if (lastIndex < text.length) {
    const plain = text.slice(lastIndex);
    if (plain) runs.push(new TextRun({ text: plain, size, font }));
  }
  return runs.length ? runs : [new TextRun({ text, size, font })];
}

// Detect Markdown heading: # H1, ## H2, ### H3, etc.
function getMdHeading(line: string): { level: number; text: string } | null {
  const m = line.trim().match(/^(#{1,6})\s+(.+)$/);
  return m ? { level: m[1].length, text: m[2].trim() } : null;
}

function isSectionHeader(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const upper = trimmed.toUpperCase();
  const knownHeaders = [
    "EXPERIENCE", "EDUCATION", "SKILLS", "SUMMARY", "OBJECTIVE",
    "PROJECTS", "CERTIFICATIONS", "AWARDS", "PUBLICATIONS", "LANGUAGES",
    "VOLUNTEER", "REFERENCES", "WORK EXPERIENCE", "PROFESSIONAL EXPERIENCE",
    "PROFESSIONAL SUMMARY", "TECHNICAL SKILLS", "CORE COMPETENCIES",
    "MILITARY SERVICE", "MILITARY", "AFFILIATIONS", "ACHIEVEMENTS",
  ];
  if (knownHeaders.some((h) => upper === h || upper.startsWith(h + " "))) return true;
  // All-caps line with no Markdown prefixes
  const noPrefix = trimmed.replace(/^#{1,6}\s*/, "");
  if (
    noPrefix === noPrefix.toUpperCase() &&
    noPrefix.length > 3 &&
    noPrefix.length < 60 &&
    /[A-Z]/.test(noPrefix) &&
    !/^\*/.test(noPrefix)
  ) return true;
  return false;
}

function isBullet(line: string): boolean {
  return /^[\s]*[-•*▪▸►]\s/.test(line);
}

function stripBullet(line: string): string {
  return line.replace(/^[\s]*[-•*▪▸►]\s+/, "").trim();
}

// Is the line a contact/subtitle line? (all-bold, or contains contact patterns right after name)
function looksLikeContact(text: string): boolean {
  const t = text.trim();
  return (
    /^\*\*/.test(t) ||
    /[@|]/.test(t) ||
    /linkedin|github|portfolio|website/i.test(t) ||
    /\d{3}[.\-\s]\d{3}/.test(t)
  );
}

function sectionHeaderParagraph(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22, font: "Calibri", color: "1a1a1a" })],
    spacing: { before: 280, after: 80 },
    border: { bottom: { color: "888888", size: 6, space: 3, style: "single" } },
  });
}

export interface ContactInfo {
  name?: string;
  email?: string;
  phone?: string;
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export async function downloadResumeDocx(text: string, filename = "tailored-resume.docx") {
  const lines = parseLines(text);
  const children: Paragraph[] = [];
  let nameWritten = false;
  let contactPhase = false; // true right after the name line

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed === "---") {
      if (!trimmed && nameWritten) children.push(new Paragraph({ spacing: { after: 60 } }));
      if (!trimmed) contactPhase = false;
      continue;
    }

    const heading = getMdHeading(trimmed);

    // H1 → candidate for name
    if (heading?.level === 1 && !nameWritten) {
      children.push(new Paragraph({
        children: [new TextRun({ text: stripMarkdown(heading.text), bold: true, size: 34, font: "Calibri", color: "111111" })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
      }));
      nameWritten = true;
      contactPhase = true;
      continue;
    }

    // H2 / H3 → section header
    if (heading && heading.level <= 3) {
      contactPhase = false;
      children.push(sectionHeaderParagraph(stripMarkdown(heading.text)));
      continue;
    }

    // H4–H6 → sub-heading
    if (heading) {
      contactPhase = false;
      children.push(new Paragraph({
        children: parseInline(heading.text, 20),
        spacing: { after: 60 },
      }));
      continue;
    }

    // No heading — first non-blank line and no name yet → treat as name
    if (!nameWritten && !isBullet(line)) {
      children.push(new Paragraph({
        children: [new TextRun({ text: stripMarkdown(trimmed), bold: true, size: 34, font: "Calibri", color: "111111" })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
      }));
      nameWritten = true;
      contactPhase = true;
      continue;
    }

    // Contact lines right after name (bold/email/phone/linkedin lines)
    if (contactPhase && looksLikeContact(trimmed)) {
      children.push(new Paragraph({
        children: [new TextRun({ text: stripMarkdown(trimmed), size: 18, font: "Calibri", color: "444444" })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 30 },
      }));
      continue;
    }
    contactPhase = false;

    // All-caps section header (plain-text resume format, no Markdown prefix)
    if (isSectionHeader(trimmed)) {
      children.push(sectionHeaderParagraph(stripMarkdown(trimmed)));
      continue;
    }

    // Bullet point
    if (isBullet(line)) {
      children.push(new Paragraph({
        bullet: { level: 0 },
        children: parseInline(stripBullet(line), 20),
        spacing: { after: 50 },
        indent: { left: convertInchesToTwip(0.2) },
      }));
      continue;
    }

    // Regular paragraph — render with inline Markdown (bold/italic preserved)
    children.push(new Paragraph({
      children: parseInline(trimmed, 20),
      spacing: { after: 60 },
    }));
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.75),
              bottom: convertInchesToTwip(0.75),
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveDocx(blob, filename);
}

export async function downloadCoverLetterDocx(
  text: string,
  filename = "cover-letter.docx",
  contact?: ContactInfo
) {
  const lines = parseLines(text);
  const children: Paragraph[] = [];

  const name = contact?.name?.trim() || "[Your Name]";
  const email = contact?.email?.trim() || "[your.email@example.com]";
  const phone = contact?.phone?.trim() || "[Your Phone Number]";
  const date = formatDate();

  const headerLine = (t: string, bold = false) =>
    new Paragraph({
      children: [new TextRun({ text: t, size: 22, font: "Garamond", bold })],
      spacing: { after: 0 },
    });

  children.push(headerLine(name, true));
  children.push(headerLine(email));
  children.push(headerLine(phone));
  children.push(headerLine(date));
  children.push(new Paragraph({ spacing: { after: 200 } }));

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      children.push(new Paragraph({ spacing: { after: 160 } }));
      continue;
    }
    if (isBullet(line)) {
      children.push(new Paragraph({
        bullet: { level: 0 },
        children: parseInline(stripBullet(line), 22, "Garamond"),
        spacing: { after: 80 },
      }));
    } else {
      children.push(new Paragraph({
        children: parseInline(stripMarkdown(trimmed), 22, "Garamond"),
        spacing: { after: 160 },
      }));
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.25),
              right: convertInchesToTwip(1.25),
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveDocx(blob, filename);
}

function savePdf(pdfDoc: jsPDF, filename: string) {
  pdfDoc.save(filename);
}

export function downloadCoverLetterPdf(
  text: string,
  filename = "cover-letter.pdf",
  contact?: ContactInfo
) {
  const pdfDoc = new jsPDF({ unit: "pt", format: "letter" });
  const marginLeft = 90;
  const marginRight = 90;
  const marginTop = 72;
  const pageWidth = pdfDoc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - marginLeft - marginRight;
  const lineHeight = 16;
  const pageHeight = pdfDoc.internal.pageSize.getHeight();
  const bottomMargin = 72;

  let y = marginTop;

  const name = contact?.name?.trim() || "[Your Name]";
  const email = contact?.email?.trim() || "[your.email@example.com]";
  const phone = contact?.phone?.trim() || "[Your Phone Number]";
  const date = formatDate();

  pdfDoc.setFont("times", "bold");
  pdfDoc.setFontSize(12);
  pdfDoc.text(name, marginLeft, y);
  y += lineHeight;

  pdfDoc.setFont("times", "normal");
  pdfDoc.setFontSize(11);
  for (const line of [email, phone, date]) {
    pdfDoc.text(line, marginLeft, y);
    y += lineHeight;
  }
  y += lineHeight;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = stripMarkdown(line.trim());
    if (!trimmed) { y += lineHeight * 0.6; continue; }
    const wrapped = pdfDoc.splitTextToSize(trimmed, maxWidth);
    for (const w of wrapped) {
      if (y + lineHeight > pageHeight - bottomMargin) { pdfDoc.addPage(); y = marginTop; }
      pdfDoc.text(w, marginLeft, y);
      y += lineHeight;
    }
    y += 4;
  }

  savePdf(pdfDoc, filename);
}

export function downloadResumePdf(text: string, filename = "tailored-resume.pdf") {
  const pdfDoc = new jsPDF({ unit: "pt", format: "letter" });
  const marginLeft = 72;
  const marginRight = 72;
  const marginTop = 54;
  const pageWidth = pdfDoc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - marginLeft - marginRight;
  const pageHeight = pdfDoc.internal.pageSize.getHeight();
  const bottomMargin = 54;

  const lines = text.split(/\r?\n/);
  let y = marginTop;
  let nameWritten = false;
  let contactPhase = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "---") {
      if (!trimmed) { y += 6; contactPhase = false; }
      continue;
    }

    const heading = getMdHeading(trimmed);

    // H1 → name
    if (heading?.level === 1 && !nameWritten) {
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(18);
      const clean = stripMarkdown(heading.text);
      const w = pdfDoc.getTextWidth(clean);
      if (y + 22 > pageHeight - bottomMargin) { pdfDoc.addPage(); y = marginTop; }
      pdfDoc.text(clean, (pageWidth - w) / 2, y);
      y += 26;
      nameWritten = true;
      contactPhase = true;
      continue;
    }

    // H2/H3 → section header
    if (heading && heading.level <= 3) {
      contactPhase = false;
      const clean = stripMarkdown(heading.text).toUpperCase();
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(11);
      if (y + 22 > pageHeight - bottomMargin) { pdfDoc.addPage(); y = marginTop; }
      y += 8;
      pdfDoc.text(clean, marginLeft, y);
      y += 4;
      pdfDoc.setDrawColor(100, 100, 100);
      pdfDoc.setLineWidth(0.5);
      pdfDoc.line(marginLeft, y, pageWidth - marginRight, y);
      y += 12;
      continue;
    }

    // No heading, first line → name
    if (!nameWritten && !isBullet(line)) {
      const clean = stripMarkdown(trimmed);
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(18);
      const w = pdfDoc.getTextWidth(clean);
      if (y + 22 > pageHeight - bottomMargin) { pdfDoc.addPage(); y = marginTop; }
      pdfDoc.text(clean, (pageWidth - w) / 2, y);
      y += 26;
      nameWritten = true;
      contactPhase = true;
      continue;
    }

    // Contact lines
    if (contactPhase && looksLikeContact(trimmed)) {
      const clean = stripMarkdown(trimmed);
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setFontSize(9);
      const w = pdfDoc.getTextWidth(clean);
      if (y + 12 > pageHeight - bottomMargin) { pdfDoc.addPage(); y = marginTop; }
      pdfDoc.text(clean, (pageWidth - w) / 2, y);
      y += 13;
      continue;
    }
    contactPhase = false;

    // Plain-text section header
    if (isSectionHeader(trimmed)) {
      const clean = stripMarkdown(trimmed).toUpperCase();
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(11);
      if (y + 22 > pageHeight - bottomMargin) { pdfDoc.addPage(); y = marginTop; }
      y += 8;
      pdfDoc.text(clean, marginLeft, y);
      y += 4;
      pdfDoc.setDrawColor(100, 100, 100);
      pdfDoc.setLineWidth(0.5);
      pdfDoc.line(marginLeft, y, pageWidth - marginRight, y);
      y += 12;
      continue;
    }

    // Bullet
    if (isBullet(line)) {
      const bulletText = stripMarkdown(stripBullet(line));
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setFontSize(10);
      const wrapped = pdfDoc.splitTextToSize(bulletText, maxWidth - 14);
      for (let idx = 0; idx < wrapped.length; idx++) {
        if (y + 14 > pageHeight - bottomMargin) { pdfDoc.addPage(); y = marginTop; }
        if (idx === 0) pdfDoc.text("•", marginLeft, y);
        pdfDoc.text(wrapped[idx], marginLeft + 14, y);
        y += 13;
      }
      y += 3;
      continue;
    }

    // Regular line — detect bold/italic for whole-line styling
    const clean = stripMarkdown(trimmed);
    const isBoldLine = /^\*\*[^*]/.test(trimmed);
    const isItalicLine = /^\*[^*]/.test(trimmed) && !/^\*\*/.test(trimmed);
    pdfDoc.setFont("helvetica", isBoldLine ? "bold" : isItalicLine ? "italic" : "normal");
    pdfDoc.setFontSize(10);
    const wrapped = pdfDoc.splitTextToSize(clean, maxWidth);
    for (const w of wrapped) {
      if (y + 14 > pageHeight - bottomMargin) { pdfDoc.addPage(); y = marginTop; }
      pdfDoc.text(w, marginLeft, y);
      y += 13;
    }
    y += 4;
  }

  savePdf(pdfDoc, filename);
}
