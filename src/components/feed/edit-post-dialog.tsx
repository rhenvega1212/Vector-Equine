"use client";

import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  uploadFileWithProgress,
  isValidImageType,
  isValidVideoType,
} from "@/lib/uploads/storage";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Image as ImageIcon, X, ImagePlus } from "lucide-react";

const AVAILABLE_TAGS = [
  "training", "dressage", "jumping", "eventing", "western",
  "horse-care", "mindset", "competition", "trail-riding",
];

interface ExistingMedia {
  id: string;
  url: string;
  media_type: "image" | "video";
  thumbnail_url?: string | null;
}

interface NewMedia {
  file: File;
  url: string;
  media_type: "image" | "video";
  coverFile?: File;
  coverUrl?: string;
}

type MediaItem =
  | { kind: "existing"; data: ExistingMedia }
  | { kind: "new"; data: NewMedia };

interface EditPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: {
    id: string;
    content: string;
    tags: string[];
    post_media: ExistingMedia[];
  };
}

export function EditPostDialog({ open, onOpenChange, post }: EditPostDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const coverTargetIndex = useRef<number | null>(null);

  const [content, setContent] = useState(post.content);
  const [tags, setTags] = useState<string[]>(post.tags || []);
  const [media, setMedia] = useState<MediaItem[]>(
    post.post_media.map((m) => ({ kind: "existing" as const, data: m }))
  );
  const [isSaving, setIsSaving] = useState(false);
  const [progress, setProgress] = useState(0);

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : prev.length < 5 ? [...prev, tag] : prev
    );
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files) return;

    const added: MediaItem[] = [];
    for (const file of Array.from(files)) {
      if (media.length + added.length >= 10) {
        toast({ title: "Too many files", description: "Maximum 10 media items.", variant: "destructive" });
        break;
      }
      if (isValidImageType(file)) {
        added.push({ kind: "new", data: { file, url: URL.createObjectURL(file), media_type: "image" } });
      } else if (isValidVideoType(file)) {
        added.push({ kind: "new", data: { file, url: URL.createObjectURL(file), media_type: "video" } });
      }
    }
    setMedia((prev) => [...prev, ...added]);
    event.target.value = "";
  }

  function removeMedia(index: number) {
    setMedia((prev) => {
      const updated = [...prev];
      const item = updated[index];
      if (item.kind === "new") {
        URL.revokeObjectURL(item.data.url);
        if (item.data.coverUrl) URL.revokeObjectURL(item.data.coverUrl);
      }
      updated.splice(index, 1);
      return updated;
    });
  }

  function handleCoverSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const idx = coverTargetIndex.current;
    if (!file || idx === null) return;
    if (!isValidImageType(file)) return;

    const url = URL.createObjectURL(file);
    setMedia((prev) => {
      const updated = [...prev];
      const item = updated[idx];
      if (item.kind === "new") {
        if (item.data.coverUrl) URL.revokeObjectURL(item.data.coverUrl);
        updated[idx] = { kind: "new", data: { ...item.data, coverFile: file, coverUrl: url } };
      }
      return updated;
    });
    if (coverInputRef.current) coverInputRef.current.value = "";
    coverTargetIndex.current = null;
  }

  async function handleSave() {
    if (!content.trim() && media.length === 0) {
      toast({ title: "Empty post", description: "Add content or media.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    setProgress(0);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload any new media files
      const newFiles = media.filter((m): m is { kind: "new"; data: NewMedia } => m.kind === "new");
      const totalUploads = newFiles.reduce((n, m) => n + 1 + (m.data.coverFile ? 1 : 0), 0);
      let completedUploads = 0;

      const finalMedia: { url: string; media_type: "image" | "video"; thumbnail_url?: string }[] = [];

      for (const item of media) {
        if (item.kind === "existing") {
          finalMedia.push({
            url: item.data.url,
            media_type: item.data.media_type,
            thumbnail_url: item.data.thumbnail_url || undefined,
          });
        } else {
          const path = `${user.id}/${Date.now()}-${item.data.file.name}`;
          const { url } = await uploadFileWithProgress(
            "post-media",
            item.data.file,
            path,
            (pct) => {
              if (totalUploads > 0) {
                const base = (completedUploads / totalUploads) * 100;
                const share = (1 / totalUploads) * pct;
                setProgress(Math.round(base + share));
              }
            }
          );
          completedUploads++;

          let thumbnailUrl: string | undefined;
          if (item.data.coverFile) {
            const coverPath = `${user.id}/${Date.now()}-cover-${item.data.coverFile.name}`;
            const coverResult = await uploadFileWithProgress("post-media", item.data.coverFile, coverPath);
            thumbnailUrl = coverResult.url;
            completedUploads++;
          }

          finalMedia.push({ url, media_type: item.data.media_type, ...(thumbnailUrl ? { thumbnail_url: thumbnailUrl } : {}) });
        }
      }

      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          tags,
          media: finalMedia,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update post");
      }

      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["home-feed"] });
      toast({ title: "Post updated" });
      onOpenChange(false);
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[100px] resize-none"
            maxLength={5000}
          />

          {/* Media grid */}
          {media.length > 0 && (
            <div className={media.length === 1 ? "" : "grid grid-cols-3 gap-2"}>
              {media.map((item, index) => {
                const url = item.kind === "existing" ? item.data.url : item.data.url;
                const type = item.kind === "existing" ? item.data.media_type : item.data.media_type;
                const isVideo = type === "video";

                return (
                  <div key={index} className={`relative overflow-hidden rounded-lg ${media.length === 1 ? "" : "aspect-square"}`}>
                    {isVideo ? (
                      <div className="relative w-full h-full">
                        {item.kind === "new" && item.data.coverUrl && (
                          <img src={item.data.coverUrl} alt="Cover" className="absolute inset-0 w-full h-full object-cover z-[1] rounded-lg" />
                        )}
                        <video
                          src={url}
                          className={media.length === 1 ? "w-full max-h-[300px] rounded-lg bg-black" : "w-full h-full object-cover rounded"}
                          muted
                        />
                      </div>
                    ) : (
                      <img
                        src={url}
                        alt=""
                        className={media.length === 1 ? "w-full max-h-[300px] object-contain bg-black/10 rounded-lg" : "w-full h-full object-cover rounded"}
                      />
                    )}
                    <div className="absolute top-1 right-1 flex gap-1 z-[2]">
                      {isVideo && item.kind === "new" && (
                        <button
                          type="button"
                          onClick={() => { coverTargetIndex.current = index; coverInputRef.current?.click(); }}
                          className="p-1.5 bg-background/80 rounded-full hover:bg-background transition-colors"
                          title="Add cover photo"
                        >
                          <ImagePlus className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeMedia(index)}
                        className="p-1.5 bg-background/80 rounded-full hover:bg-background transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileSelect} />
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverSelect} />
            <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={media.length >= 10}>
              <ImageIcon className="h-4 w-4 mr-2" />
              Add Media
            </Button>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_TAGS.map((tag) => (
              <Badge
                key={tag}
                variant={tags.includes(tag) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>

          {/* Progress */}
          {isSaving && progress > 0 && progress < 100 && (
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-cyan-400 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
