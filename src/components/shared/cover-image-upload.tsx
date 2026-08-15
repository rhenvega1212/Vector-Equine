"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MediaCropper } from "@/components/feed/media-cropper";
import { createClient } from "@/lib/supabase/client";
import {
  uploadFile,
  isValidImageType,
  isValidFileSize,
  MAX_IMAGE_SIZE_MB,
} from "@/lib/uploads/storage";
import { X, Loader2, ImageIcon, Pencil } from "lucide-react";

interface CoverImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  bucket?: "event-banners" | "avatars" | "horse-photos";
  pathPrefix?: string;
  /** Height class for the preview container (ignored when aspectRatio is 1). */
  previewHeight?: string;
  /** Locked crop aspect. Horse photos use 1 (square). */
  aspectRatio?: number;
  disabled?: boolean;
}

export function CoverImageUpload({
  value,
  onChange,
  bucket = "event-banners",
  pathPrefix = "covers",
  previewHeight = "h-48",
  aspectRatio,
  disabled = false,
}: CoverImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropperSrc, setCropperSrc] = useState<string | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileSelect = useCallback((file: File) => {
    setError(null);

    if (!isValidImageType(file)) {
      setError("Please upload a JPG, PNG, GIF, or WebP image.");
      return;
    }
    if (!isValidFileSize(file, MAX_IMAGE_SIZE_MB)) {
      setError(`File too large. Max ${MAX_IMAGE_SIZE_MB}MB.`);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setCropperSrc(objectUrl);
    setCropperOpen(true);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
      e.target.value = "";
    },
    [handleFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleCropComplete = useCallback(
    async (croppedBlob: Blob) => {
      setIsUploading(true);
      setError(null);
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          throw new Error("Sign in to upload a photo.");
        }

        const file = new File([croppedBlob], `cover-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        // Storage RLS expects first folder = auth.uid() (same as avatars).
        const objectPath = `${user.id}/${pathPrefix}/${Date.now()}-${file.name}`;
        const { url } = await uploadFile(bucket, file, objectPath);
        onChange(url);
      } catch (err) {
        const message =
          err instanceof Error && err.message
            ? err.message.replace(/^Failed to upload file:\s*/i, "")
            : "Upload failed. Please try again.";
        setError(message);
      } finally {
        setIsUploading(false);
        if (cropperSrc) {
          URL.revokeObjectURL(cropperSrc);
          setCropperSrc(null);
        }
      }
    },
    [bucket, pathPrefix, onChange, cropperSrc]
  );

  const handleRemove = useCallback(() => {
    onChange(null);
    setError(null);
  }, [onChange]);

  const isSquare = aspectRatio === 1;
  const frameClass = isSquare
    ? "aspect-square w-full max-w-xs mx-auto"
    : `w-full ${previewHeight}`;

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled || isUploading}
      />

      {value ? (
        <div className={`relative group ${frameClass}`}>
          <img
            src={value}
            alt="Horse photo preview"
            className="h-full w-full object-cover rounded-lg border border-gold/20"
          />
          <div className="absolute inset-0 rounded-lg pointer-events-none border-2 border-transparent group-hover:border-gold/30 transition-colors" />

          {!disabled && (
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-white/50 text-white hover:bg-white/20 hover:text-white"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Pencil className="h-4 w-4 mr-2" />
                )}
                Change
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-red-400/50 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                onClick={handleRemove}
                disabled={isUploading}
              >
                <X className="h-4 w-4 mr-2" />
                Remove
              </Button>
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-gold" />
                <span className="text-sm text-white">Uploading...</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          disabled={disabled || isUploading}
          className={`
            ${frameClass} border-2 border-dashed rounded-lg
            flex flex-col items-center justify-center gap-2
            transition-all cursor-pointer
            ${isDragOver
              ? "border-gold bg-gold/10"
              : "border-muted-foreground/25 hover:border-gold/50 hover:bg-muted/50"
            }
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          {isUploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center">
                <ImageIcon className="h-6 w-6 text-gold/70" />
              </div>
              <div className="text-center px-3">
                <p className="text-sm font-medium text-foreground/80">
                  {isDragOver
                    ? "Drop image here"
                    : isSquare
                      ? "Upload horse photo"
                      : "Upload cover image"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isSquare
                    ? `Square crop · JPG, PNG, WebP up to ${MAX_IMAGE_SIZE_MB}MB`
                    : `Drag & drop or click. JPG, PNG, GIF, WebP up to ${MAX_IMAGE_SIZE_MB}MB`}
                </p>
              </div>
            </>
          )}
        </button>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {cropperSrc && (
        <MediaCropper
          open={cropperOpen}
          onOpenChange={(open) => {
            setCropperOpen(open);
            if (!open && cropperSrc) {
              URL.revokeObjectURL(cropperSrc);
              setCropperSrc(null);
            }
          }}
          imageSrc={cropperSrc}
          onCropComplete={handleCropComplete}
          aspectRatio={aspectRatio}
        />
      )}
    </div>
  );
}
