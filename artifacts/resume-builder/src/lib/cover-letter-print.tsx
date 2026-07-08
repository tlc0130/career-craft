import React from "react";
import ReactDOMServer from "react-dom/server";
import { getTemplate } from "@/components/templates";
import { CoverLetterDocument, CoverLetterContact } from "@/components/CoverLetterDocument";

export function printCoverLetter(
  templateId: string,
  contact: CoverLetterContact | undefined,
  body: string,
  title: string,
): void {
  const theme = getTemplate(templateId).theme;
  const bodyHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(CoverLetterDocument, { contact, body, theme }),
  );

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @media print {
      @page { size: letter; margin: 0; }
      body { margin: 0; padding: 0; }
      #screen-controls { display: none !important; }
    }
    @media screen {
      body {
        margin: 0; padding: 0; background: #e5e7eb; min-height: 100vh;
        display: flex; flex-direction: column; align-items: center;
      }
      #screen-controls {
        position: fixed; top: 0; left: 0; right: 0; background: #1f2937; color: #f9fafb;
        padding: 10px 20px; display: flex; align-items: center; justify-content: space-between;
        z-index: 9999; font-family: system-ui, sans-serif; font-size: 14px;
      }
      #screen-controls button {
        background: #3b82f6; color: #fff; border: none; border-radius: 6px;
        padding: 6px 16px; cursor: pointer; font-size: 13px; font-weight: 600; margin-left: 8px;
      }
      #screen-controls button.close-btn { background: #6b7280; }
      #doc-wrapper { margin-top: 56px; padding: 20px 0 40px; display: flex; justify-content: center; }
    }
  </style>
</head>
<body>
  <div id="screen-controls">
    <span>${escapeHtml(title)}</span>
    <div>
      <button onclick="window.print()">Print / Save PDF</button>
      <button class="close-btn" onclick="window.close()">Close</button>
    </div>
  </div>
  <div id="doc-wrapper">${bodyHtml}</div>
</body>
</html>`;

  const popup = window.open("", "_blank", "width=900,height=700,scrollbars=yes,resizable=yes");
  if (!popup) {
    alert("Popup blocked. Please allow popups for this site and try again.");
    return;
  }
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
