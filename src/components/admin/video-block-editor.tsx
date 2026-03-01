"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  uploadFileWithProgress,
  isValidVideoType,
  isValidFileSize,
  MAX_VIDEO_SIZE_MB,
} from "@/lib/uploads/storage";
import {
  Upload,
  Save,
  Loader2,
  Play,
  Link as LinkIcon,
  Check,
  X,
  ExternalLink,
} from "lucide-react";

interface VideoBlockEditorProps {
  blockId: string;
  challengeId: string;
  initialUrl: string;
  onSave: (url: string) => void;
  onUploadStart?: () => void;
  onUploadEnd?: () => void;
}

function parseVideoUrl(url: string) {
  if (!url) return null;

  // YouTube: various formats
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/
  );
  if (ytMatch) {
    return {
      type: "youtube" as const,
      id: ytMatch[1],
      thumbnail: `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`,
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`,
    };
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return {
      type: "vimeo" as const,
      id: vimeoMatch[1],
      thumbnail: null,
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
    };
  }

  // Direct video URL
  const videoExtensions = /\.(mp4|webm|mov|ogg)(\?.*)?$/i;
  if (videoExtensions.test(url) || url.includes("supabase")) {
    return {
      type: "direct" as const,
      id: null,
      thumbnail: null,
      embedUrl: url,
    };
  }

  // Treat unknown URLs as direct/embeddable
  return {
    type: "unknown" as const,
    id: null,
    thumbnail: null,
    embedUrl: url,
  };
}

export function VideoBlockEditor({
  blockId,
  challengeId,
  initialUrl,
  onSave,
  onUploadStart,
  onUploadEnd,
}: VideoBlockEditorProps) {
  const [urlInput, setUrlInput] = useState(initialUrl);
  const [savedUrl, setSavedUrl] = useState(initialUrl);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vimeoThumb, setVimeoThumb] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsed = parseVideoUrl(savedUrl);

  // Fetch Vimeo thumbnail
  useEffect(() => {
    if (parsed?.type !== "vimeo" || !parsed.id) return;
    setVimeoThumb(null);
    fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${parsed.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.thumbnail_url) setVimeoThumb(data.thumbnail_url);
      })
      .catch(() => {});
  }, [parsed?.type, parsed?.id]);

  const handleSaveUrl = useCallback(async () => {
    if (!urlInput.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/content-blocks/${blockId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: urlInput.trim() }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSavedUrl(urlInput.trim());
      onSave(urlInput.trim());
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      setError("Failed to save video URL. Try again.");
    } finally {
      setIsSaving(false);
    }
  }, [urlInput, blockId, onSave]);

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!isValidVideoType(file)) {
        setError("Please upload an MP4, WebM, or MOV video.");
        return;
      }
      if (!isValidFileSize(file, MAX_VIDEO_SIZE_MB)) {
        setError(`File too large. Max ${MAX_VIDEO_SIZE_MB}MB.`);
        return;
      }

      setIsUploading(true);
      setUploadProgress(0);
      setError(null);
      onUploadStart?.();
      try {
        const { url } = await uploadFileWithProgress(
          "challenge-media",
          file,
          `blocks/${challengeId}/${blockId}/${Date.now()}-${file.name}`,
          (percent) => setUploadProgress(percent)
        );
        // Also PATCH to DB
        await fetch(`/api/admin/content-blocks/${blockId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: url }),
        });
        setUrlInput(url);
        setSavedUrl(url);
        onSave(url);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } catch {
        setError("Upload failed. Please try again.");
      } finally {
        setIsUploading(false);
        onUploadEnd?.();
      }
    },
    [blockId, challengeId, onSave, onUploadStart, onUploadEnd]
  );

  const handleClear = useCallback(() => {
    setUrlInput("");
    setError(null);
  }, []);

  const thumbnailUrl =
    parsed?.type === "youtube"
      ? parsed.thumbnail
      : parsed?.type === "vimeo"
        ? vimeoThumb
        : null;

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
          e.target.value = "";
        }}
      />

      {/* Upload button + progress bar */}
      {isUploading ? (
        <div className="space-y-2 p-3 rounded-lg border border-cyan-400/20 bg-cyan-400/5">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
              <span className="font-medium">Uploading video...</span>
            </div>
            <span className="text-muted-foreground tabular-nums">{uploadProgress}%</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          {uploadProgress === 100 && (
            <p className="text-xs text-muted-foreground">Processing...</p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3 w-3 mr-1" />
            Upload Video
          </Button>
          <span className="text-xs text-muted-foreground">or paste a link below</span>
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              setError(null);
              setSaveSuccess(false);
            }}
            placeholder="Paste YouTube, Vimeo, or direct video URL..."
            className="pl-9 pr-9"
          />
          {urlInput && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          type="button"
          size="default"
          disabled={isSaving || !urlInput.trim()}
          onClick={handleSaveUrl}
          className={
            saveSuccess
              ? "bg-green-600 hover:bg-green-500 text-white"
              : "bg-cyan-500 hover:bg-cyan-400 text-black"
          }
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : saveSuccess ? (
            <Check className="h-4 w-4 mr-1" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          {isSaving ? "Saving..." : saveSuccess ? "Saved!" : "Save"}
        </Button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Thumbnail / Preview */}
      {savedUrl && parsed && (
        <div className="relative rounded-lg overflow-hidden border border-cyan-400/20 bg-black/30">
          {thumbnailUrl ? (
            /* YouTube / Vimeo thumbnail */
            <div className="relative">
              <img
                src={thumbnailUrl}
                alt="Video thumbnail"
                className="w-full h-44 object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
                  <Play className="h-7 w-7 text-white ml-1" />
                </div>
              </div>
              <div className="absolute bottom-2 left-2">
                <span className="text-xs bg-black/70 text-white px-2 py-1 rounded-md capitalize">
                  {parsed.type}
                </span>
              </div>
              <a
                href={savedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-md hover:bg-black/80 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5 text-white" />
              </a>
            </div>
          ) : parsed.type === "direct" ? (
            /* Direct video file preview */
            <video
              src={savedUrl}
              controls
              preload="metadata"
              className="w-full max-h-52 rounded-lg"
            />
          ) : (
            /* Unknown / fallback */
            <div className="flex items-center gap-3 p-4">
              <div className="w-12 h-12 rounded-lg bg-cyan-400/10 flex items-center justify-center flex-shrink-0">
                <Play className="h-6 w-6 text-cyan-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{savedUrl}</p>
                <p className="text-xs text-muted-foreground">
                  Video link saved
                </p>
              </div>
              <a
                href={savedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
              >
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
