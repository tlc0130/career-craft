import { TemplateTheme } from "./templates/types";

export interface CoverLetterContact {
  name?: string;
  email?: string;
  phone?: string;
}

interface Props {
  contact?: CoverLetterContact;
  body: string;
  theme: TemplateTheme;
}

// A styled cover-letter "page" at full render width. Used both for the on-screen
// preview (scaled) and for print/PDF (via renderToStaticMarkup). Cover letters
// are prose, so the template only drives the letterhead, accent rule, and font.
export function CoverLetterDocument({ contact, body, theme }: Props) {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const contactLine = [contact?.email, contact?.phone].filter(Boolean).join("  •  ");

  return (
    <div
      style={{
        width: "794px",
        minHeight: "1123px",
        boxSizing: "border-box",
        background: "#ffffff",
        color: theme.text,
        fontFamily: theme.fontFamily,
        padding: "64px 72px",
      }}
    >
      {/* Letterhead */}
      <div style={{ borderBottom: `3px solid ${theme.accent}`, paddingBottom: "16px", marginBottom: "32px" }}>
        <div style={{ fontSize: "28px", fontWeight: 700, color: theme.accent, letterSpacing: "-0.01em" }}>
          {contact?.name || "Your Name"}
        </div>
        {contactLine && (
          <div style={{ fontSize: "13px", color: theme.muted, marginTop: "8px" }}>{contactLine}</div>
        )}
      </div>

      {/* Body */}
      <div style={{ fontSize: "14.5px", lineHeight: 1.7 }}>
        {paragraphs.map((p, i) => (
          <p key={i} style={{ margin: "0 0 14px", whiteSpace: "pre-wrap" }}>
            {p}
          </p>
        ))}
      </div>
    </div>
  );
}
