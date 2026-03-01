import { FileText, Download } from "lucide-react";
import type { BlockRendererProps } from "@/lib/blocks/types";
import type { DownloadSettings } from "@/lib/blocks/types";

export function DownloadBlockRenderer({ block }: BlockRendererProps) {
  if (!block.content) return null;

  const settings = block.settings as unknown as Partial<DownloadSettings>;
  const fileName = block.file_name || "Download";

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10">
        <FileText className="h-6 w-6 text-cyan-400" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{settings?.label || fileName}</p>
        {settings?.description && (
          <p className="mt-0.5 text-sm text-muted-foreground">
            {settings.description}
          </p>
        )}
      </div>

      <a
        href={block.content}
        download={fileName}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-cyan-400"
      >
        <Download className="h-4 w-4" />
        Download
      </a>
    </div>
  );
}
