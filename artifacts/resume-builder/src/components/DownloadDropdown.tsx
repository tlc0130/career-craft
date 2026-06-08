import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, ChevronDown, FileText, FileType } from "lucide-react";

interface DownloadDropdownProps {
  onDownloadDocx: () => Promise<void> | void;
  onDownloadPdf: () => Promise<void> | void;
  size?: "sm" | "default";
}

export function DownloadDropdown({ onDownloadDocx, onDownloadPdf, size = "sm" }: DownloadDropdownProps) {
  const [loading, setLoading] = useState<"docx" | "pdf" | null>(null);

  const handleDocx = async () => {
    setLoading("docx");
    try {
      await onDownloadDocx();
    } finally {
      setLoading(null);
    }
  };

  const handlePdf = async () => {
    setLoading("pdf");
    try {
      await onDownloadPdf();
    } finally {
      setLoading(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} className="gap-2" disabled={loading !== null}>
          <Download className="w-4 h-4" />
          {loading ? "Downloading…" : "Download"}
          <ChevronDown className="w-3 h-3 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={handleDocx} className="gap-2 cursor-pointer">
          <FileText className="w-4 h-4 text-blue-600" />
          <div>
            <div className="font-medium text-sm">DOCX</div>
            <div className="text-xs text-muted-foreground">Editable document</div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePdf} className="gap-2 cursor-pointer">
          <FileType className="w-4 h-4 text-red-500" />
          <div>
            <div className="font-medium text-sm">PDF</div>
            <div className="text-xs text-muted-foreground">Ready to attach</div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
