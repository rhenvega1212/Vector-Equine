"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { uploadFile } from "@/lib/uploads/storage";
import { ImagePlus, Loader2, RefreshCw } from "lucide-react";
import type { BlockEditorProps } from "@/lib/blocks/types";

export function ImageBlockEditor({ block, onUpdate }: BlockEditorProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const imageUrl = block.content;

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
      onUpdate({ content: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {isUploading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-cyan-400/30 bg-cyan-400/5 p-8">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
          <span className="text-sm font-medium">Uploading image...</span>
        </div>
      ) : imageUrl ? (
        <div className="relative rounded-lg overflow-hidden border border-border">
          <Image
            src={imageUrl}
            alt="Block image"
            width={600}
            height={400}
            className="w-full h-auto object-contain max-h-64"
          />
          <div className="absolute top-2 right-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Change
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 p-8 text-muted-foreground transition-colors hover:border-cyan-400/40 hover:bg-cyan-400/5"
        >
          <ImagePlus className="h-8 w-8" />
          <span className="text-sm font-medium">Click to upload an image</span>
        </button>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
