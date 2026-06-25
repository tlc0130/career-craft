import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

type DiffChunk = { type: "equal" | "insert" | "delete"; text: string };

function tokenize(text: string): string[] {
  return text.split(/(\s+)/);
}

function lcsMatrix(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp;
}

function backtrack(dp: number[][], a: string[], b: string[]): DiffChunk[] {
  const chunks: DiffChunk[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      chunks.unshift({ type: "equal", text: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      chunks.unshift({ type: "insert", text: b[j - 1] });
      j--;
    } else {
      chunks.unshift({ type: "delete", text: a[i - 1] });
      i--;
    }
  }
  return chunks;
}

function computeDiff(oldText: string, newText: string): DiffChunk[] {
  const a = tokenize(oldText);
  const b = tokenize(newText);

  // Fall back to line-level diff if texts are very large
  if (a.length * b.length > 600_000) {
    const lines_a = oldText.split("\n");
    const lines_b = newText.split("\n");
    const dp = lcsMatrix(lines_a, lines_b);
    return backtrack(dp, lines_a, lines_b).map((c) => ({
      ...c,
      text: c.text + "\n",
    }));
  }

  const dp = lcsMatrix(a, b);
  return backtrack(dp, a, b);
}

interface Props {
  original: string;
  tailored: string;
}

export function DiffViewer({ original, tailored }: Props) {
  const chunks = useMemo(() => computeDiff(original, tailored), [original, tailored]);

  const leftChunks = chunks.filter((c) => c.type !== "insert");
  const rightChunks = chunks.filter((c) => c.type !== "delete");

  function renderChunks(items: DiffChunk[]) {
    return items.map((chunk, i) => {
      if (chunk.type === "equal") {
        return <span key={i}>{chunk.text}</span>;
      }
      if (chunk.type === "delete") {
        return (
          <mark
            key={i}
            style={{
              background: "#fee2e2",
              color: "#b91c1c",
              textDecoration: "line-through",
              borderRadius: "2px",
            }}
          >
            {chunk.text}
          </mark>
        );
      }
      return (
        <mark
          key={i}
          style={{
            background: "#dcfce7",
            color: "#15803d",
            textDecoration: "none",
            borderRadius: "2px",
          }}
        >
          {chunk.text}
        </mark>
      );
    });
  }

  return (
    <div className="grid grid-cols-2 gap-3 h-full min-h-0">
      <div className="flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Original</span>
        </div>
        <ScrollArea className="flex-1 bg-white rounded-lg border border-border/50 p-4">
          <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
            {renderChunks(leftChunks)}
          </pre>
        </ScrollArea>
      </div>
      <div className="flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
          <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">Tailored</span>
        </div>
        <ScrollArea className="flex-1 bg-white rounded-lg border border-green-500/20 p-4">
          <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
            {renderChunks(rightChunks)}
          </pre>
        </ScrollArea>
      </div>
    </div>
  );
}
