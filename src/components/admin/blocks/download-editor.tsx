"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { uploadFile } from "@/lib/uploads/storage";
import { FileUp, Loader2, FileText, Download, Trash2 } from "lucide-react";
import type { BlockEditorProps } from "@/lib/blocks/types";

export function DownloadBlockEditor({ block, onUpdate }: BlockEditorProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileUrl = block.content;
  const fileName = block.file_name;

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setIsUploading(true);
    setError(null);
    try {
      const { url } = await uploadFile(
        "challenge-media",
        file,
        `blocks/${block.id}/${file.name}`
      );
      onUpdate({ content: url, file_name: file.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  function handleRemove() {
    onUpdate({ content: null, file_name: null });
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
      />

      {isUploading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-cyan-400/30 bg-cyan-400/5 p-8">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
          <span className="text-sm font-medium">Uploading file...</span>
        </div>
      ) : fileUrl && fileName ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-400/10">
            <FileText className="h-5 w-5 text-cyan-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{fileName}</p>
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-cyan-400 hover:underline"
            >
              <Download className="mr-1 inline h-3 w-3" />
              Download
            </a>
          </div>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Replace
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleRemove}
              className="text-red-400 hover:text-red-300"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 p-8 text-muted-foreground transition-colors hover:border-cyan-400/40 hover:bg-cyan-400/5"
        >
          <FileUp className="h-8 w-8" />
          <span className="text-sm font-medium">Click to upload a file</span>
        </button>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
