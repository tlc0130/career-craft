import { useLayoutEffect, useRef, useState } from "react";
import { getTemplate } from "./templates";
import { CoverLetterDocument, CoverLetterContact } from "./CoverLetterDocument";

const PAGE_WIDTH = 794;

interface Props {
  templateId: string;
  contact?: CoverLetterContact;
  body: string;
}

// Renders the styled cover letter scaled to fit its container width.
export function CoverLetterPreview({ templateId, contact, body }: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [scaledHeight, setScaledHeight] = useState(0);
  const theme = getTemplate(templateId).theme;

  useLayoutEffect(() => {
    function update() {
      const outer = outerRef.current;
      const inner = innerRef.current;
      if (!outer || !inner) return;
      const s = Math.min(1, outer.clientWidth / PAGE_WIDTH);
      setScale(s);
      setScaledHeight(inner.offsetHeight * s);
    }
    update();
    const ro = new ResizeObserver(update);
    if (outerRef.current) ro.observe(outerRef.current);
    if (innerRef.current) ro.observe(innerRef.current);
    return () => ro.disconnect();
  }, [templateId, contact, body]);

  return (
    <div ref={outerRef} className="w-full">
      <div style={{ height: scaledHeight || undefined }}>
        <div
          ref={innerRef}
          style={{ width: `${PAGE_WIDTH}px`, transformOrigin: "top left", transform: `scale(${scale})` }}
        >
          <CoverLetterDocument contact={contact} body={body} theme={theme} />
        </div>
      </div>
    </div>
  );
}
