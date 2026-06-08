import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  convertInchesToTwip,
  PageBreak,
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
  return `${prefix} \u2013 ${parts.join(" ")}.${ext}`;
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

function isSectionHeader(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const upper = trimmed.toUpperCase();
  const knownHeaders = [
    "EXPERIENCE", "EDUCATION", "SKILLS", "SUMMARY", "OBJECTIVE",
    "PROJECTS", "CERTIFICATIONS", "AWARDS", "PUBLICATIONS", "LANGUAGES",
    "VOLUNTEER", "REFERENCES", "WORK EXPERIENCE", "PROFESSIONAL EXPERIENCE",
    "PROFESSIONAL SUMMARY", "TECHNICAL SKILLS", "CORE COMPETENCIES",
  ];
  if (knownHeaders.some((h) => upper === h || upper.startsWith(h + " "))) return true;
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.length < 50 && /[A-Z]/.test(trimmed)) return true;
  return false;
}

function isBullet(line: string): boolean {
  return /^[\s]*[-•*▪▸►]\s/.test(line);
}

function stripBullet(line: string): string {
  return line.replace(/^[\s]*[-•*▪▸►]\s+/, "").trim();
}

export interface ContactInfo {
  name?: string;
  email?: string;
  phone?: string;
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function headerParagraph(text: string, bold = false): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 24, font: "Garamond", bold })],
    spacing: { after: 0 },
    alignment: AlignmentType.LEFT,
  });
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

  children.push(headerParagraph(name, true));
  children.push(headerParagraph(email));
  children.push(headerParagraph(phone));
  children.push(headerParagraph(date));
  children.push(new Paragraph({ spacing: { after: 200 } }));

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      children.push(new Paragraph({ spacing: { after: 160 } }));
      continue;
    }

    if (isBullet(line)) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text: stripBullet(line), size: 24, font: "Garamond" })],
          spacing: { after: 80 },
        })
      );
    } else {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed, size: 24, font: "Garamond" })],
          spacing: { after: 160 },
          alignment: AlignmentType.LEFT,
        })
      );
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

export async function downloadResumeDocx(text: string, filename = "tailored-resume.docx") {
  const lines = parseLines(text);
  const children: Paragraph[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      children.push(new Paragraph({ spacing: { after: 120 } }));
      continue;
    }

    if (i === 0 && !isSectionHeader(trimmed) && !isBullet(line)) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmed,
              bold: true,
              size: 36,
              font: "Calibri",
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
        })
      );
      continue;
    }

    if (isSectionHeader(trimmed)) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({
              text: trimmed,
              bold: true,
              size: 26,
              font: "Calibri",
              color: "1a1a1a",
            }),
          ],
          spacing: { before: 240, after: 80 },
          border: {
            bottom: {
              color: "888888",
              size: 6,
              space: 4,
              style: "single",
            },
          },
        })
      );
      continue;
    }

    if (isBullet(line)) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text: stripBullet(line), size: 22, font: "Calibri" })],
          spacing: { after: 60 },
        })
      );
      continue;
    }

    children.push(
      new Paragraph({
        children: [new TextRun({ text: trimmed, size: 22, font: "Calibri" })],
        spacing: { after: 80 },
      })
    );
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

  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) {
      y += lineHeight * 0.6;
      continue;
    }
    const wrapped = pdfDoc.splitTextToSize(line.trim(), maxWidth);
    for (const wrappedLine of wrapped) {
      if (y + lineHeight > pageHeight - bottomMargin) {
        pdfDoc.addPage();
        y = marginTop;
      }
      pdfDoc.text(wrappedLine, marginLeft, y);
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
  let isFirst = true;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      y += 8;
      continue;
    }

    if (isFirst && !isSectionHeader(trimmed) && !isBullet(line)) {
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(18);
      const nameWidth = pdfDoc.getTextWidth(trimmed);
      const nameX = (pageWidth - nameWidth) / 2;
      if (y + 22 > pageHeight - bottomMargin) { pdfDoc.addPage(); y = marginTop; }
      pdfDoc.text(trimmed, nameX, y);
      y += 28;
      isFirst = false;
      continue;
    }

    isFirst = false;

    if (isSectionHeader(trimmed)) {
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(11);
      if (y + 22 > pageHeight - bottomMargin) { pdfDoc.addPage(); y = marginTop; }
      y += 6;
      pdfDoc.text(trimmed, marginLeft, y);
      y += 4;
      pdfDoc.setDrawColor(100, 100, 100);
      pdfDoc.setLineWidth(0.5);
      pdfDoc.line(marginLeft, y, pageWidth - marginRight, y);
      y += 12;
      continue;
    }

    if (isBullet(line)) {
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setFontSize(10);
      const bulletText = stripBullet(line);
      const wrapped = pdfDoc.splitTextToSize(bulletText, maxWidth - 14);
      for (let i = 0; i < wrapped.length; i++) {
        if (y + 14 > pageHeight - bottomMargin) { pdfDoc.addPage(); y = marginTop; }
        if (i === 0) {
          pdfDoc.text("•", marginLeft, y);
          pdfDoc.text(wrapped[i], marginLeft + 14, y);
        } else {
          pdfDoc.text(wrapped[i], marginLeft + 14, y);
        }
        y += 13;
      }
      y += 3;
      continue;
    }

    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(10);
    const wrapped = pdfDoc.splitTextToSize(trimmed, maxWidth);
    for (const wrappedLine of wrapped) {
      if (y + 14 > pageHeight - bottomMargin) { pdfDoc.addPage(); y = marginTop; }
      pdfDoc.text(wrappedLine, marginLeft, y);
      y += 13;
    }
    y += 4;
  }

  savePdf(pdfDoc, filename);
}
