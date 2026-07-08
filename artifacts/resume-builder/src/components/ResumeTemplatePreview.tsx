import { useLayoutEffect, useRef, useState } from "react";
import TemplateRenderer from "./TemplateRenderer";
import { ResumeContent } from "./templates/types";

const PAGE_WIDTH = 794; // A4/Letter render width used by the templates

interface Props {
  templateId: string;
  data: ResumeContent;
}

// Renders a full-width resume template scaled down to fit whatever container
// it sits in (measured, so it stays crisp on any panel width).
export function ResumeTemplatePreview({ templateId, data }: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [scaledHeight, setScaledHeight] = useState(0);

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
  }, [templateId, data]);

  return (
    <div ref={outerRef} className="w-full">
      <div style={{ height: scaledHeight || undefined }}>
        <div
          ref={innerRef}
          style={{
            width: `${PAGE_WIDTH}px`,
            transformOrigin: "top left",
            transform: `scale(${scale})`,
            backgroundColor: "#ffffff",
          }}
        >
          <TemplateRenderer templateId={templateId} data={data} />
        </div>
      </div>
    </div>
  );
}
