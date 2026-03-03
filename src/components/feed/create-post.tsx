"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { isValidImageType, isValidVideoType } from "@/lib/uploads/storage";
import { useUploadManager } from "@/lib/uploads/upload-manager";
import { Image as ImageIcon, X, Crop, MessageSquare, Share2, ImagePlus } from "lucide-react";
import { MediaCropper } from "./media-cropper";

const AVAILABLE_TAGS = [
  "training",
  "dressage",
  "jumping",
  "eventing",
  "western",
  "horse-care",
  "mindset",
  "competition",
  "trail-riding",
];

interface MediaItem {
  url: string;
  media_type: "image" | "video";
  file?: File;
  coverUrl?: string;
  coverFile?: File;
}

export interface DiscussionModeProps {
  challengeId: string;
  blockId: string;
  prompt?: string;
  onPostCreated?: () => void;
}

interface CreatePostProps {
  discussionMode?: DiscussionModeProps;
}

export function CreatePost({ discussionMode }: CreatePostProps = {}) {
  const { toast } = useToast();
  const { submitPost } = useUploadManager();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const coverTargetIndex = useRef<number | null>(null);
  
  const [content, setContent] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperIndex, setCropperIndex] = useState<number | null>(null);
  const [shareToFeed, setShareToFeed] = useState(false);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : prev.length < 5
        ? [...prev, tag]
        : prev
    );
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files) return;

    const newMedia: MediaItem[] = [];

    for (const file of Array.from(files)) {
      if (media.length + newMedia.length >= 10) {
        toast({
          title: "Too many files",
          description: "You can only upload up to 10 files per post.",
          variant: "destructive",
        });
        break;
      }

      if (isValidImageType(file)) {
        const url = URL.createObjectURL(file);
        newMedia.push({ url, media_type: "image", file });
      } else if (isValidVideoType(file)) {
        const url = URL.createObjectURL(file);
        newMedia.push({ url, media_type: "video", file });
      } else {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not a supported image or video format.`,
          variant: "destructive",
        });
      }
    }

    setMedia((prev) => [...prev, ...newMedia]);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeMedia(index: number) {
    setMedia((prev) => {
      const newMedia = [...prev];
      if (newMedia[index].coverUrl) URL.revokeObjectURL(newMedia[index].coverUrl!);
      URL.revokeObjectURL(newMedia[index].url);
      newMedia.splice(index, 1);
      return newMedia;
    });
  }

  function handleCoverSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const idx = coverTargetIndex.current;
    if (!file || idx === null) return;

    if (!isValidImageType(file)) {
      toast({
        title: "Invalid file type",
        description: "Cover photo must be a JPEG, PNG, GIF, or WebP image.",
        variant: "destructive",
      });
      return;
    }

    const url = URL.createObjectURL(file);
    setMedia((prev) => {
      const updated = [...prev];
      if (updated[idx]?.coverUrl) URL.revokeObjectURL(updated[idx].coverUrl!);
      updated[idx] = { ...updated[idx], coverUrl: url, coverFile: file };
      return updated;
    });

    if (coverInputRef.current) coverInputRef.current.value = "";
    coverTargetIndex.current = null;
  }

  function openCoverPicker(index: number) {
    coverTargetIndex.current = index;
    coverInputRef.current?.click();
  }

  function openCropper(index: number) {
    setCropperIndex(index);
    setCropperOpen(true);
  }

  function handleCropComplete(croppedBlob: Blob) {
    if (cropperIndex === null) return;
    setMedia((prev) => {
      const updated = [...prev];
      const old = updated[cropperIndex];
      URL.revokeObjectURL(old.url);
      const croppedUrl = URL.createObjectURL(croppedBlob);
      const croppedFile = new File([croppedBlob], old.file?.name || "cropped.jpg", {
        type: "image/jpeg",
      });
      updated[cropperIndex] = { url: croppedUrl, media_type: "image", file: croppedFile };
      return updated;
    });
    setCropperIndex(null);
  }

  function handleSubmit() {
    if (!content.trim() && media.length === 0) {
      toast({
        title: "Empty post",
        description: "Please add some content or media to your post.",
        variant: "destructive",
      });
      return;
    }

    // Snapshot current form data and hand off to the background upload manager
    submitPost({
      content: content.trim(),
      tags: discussionMode ? [] : selectedTags,
      media: media
        .filter((m) => m.file)
        .map((m) => ({
          file: m.file!,
          media_type: m.media_type,
          coverFile: m.coverFile,
        })),
      challengeId: discussionMode?.challengeId,
      blockId: discussionMode?.blockId,
      isFeedVisible: discussionMode ? shareToFeed : undefined,
    });

    // Reset form immediately so the user can keep browsing
    setContent("");
    setSelectedTags([]);
    setMedia([]);
    setShareToFeed(false);

    toast({
      title: "Uploading...",
      description: "Your post is being uploaded in the background. You can keep browsing!",
    });

    discussionMode?.onPostCreated?.();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {discussionMode?.prompt && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
            <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
            <p className="text-sm font-medium">{discussionMode.prompt}</p>
          </div>
        )}

        <Textarea
          placeholder={
            discussionMode
              ? "Share your thoughts on this discussion..."
              : "What's on your mind?"
          }
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[100px] resize-none"
          maxLength={5000}
        />

        {media.length > 0 && (
          <div className={`mt-4 ${media.length === 1 ? "" : "grid grid-cols-3 gap-2"}`}>
            {media.map((item, index) => (
              <div
                key={index}
                className={`relative overflow-hidden rounded-lg ${
                  media.length === 1 ? "" : "aspect-square"
                }`}
              >
                {item.media_type === "image" ? (
                  <img
                    src={item.url}
                    alt=""
                    className={
                      media.length === 1
                        ? "w-full max-h-[400px] object-contain bg-black/10 rounded-lg"
                        : "w-full h-full object-cover rounded"
                    }
                  />
                ) : (
                  <div className="relative">
                    {item.coverUrl && (
                      <img
                        src={item.coverUrl}
                        alt="Cover"
                        className="absolute inset-0 w-full h-full object-cover z-[1] rounded-lg"
                      />
                    )}
                    <video
                      src={item.url}
                      className={
                        media.length === 1
                          ? "w-full max-h-[400px] rounded-lg bg-black"
                          : "w-full h-full object-cover rounded"
                      }
                      controls
                    />
                  </div>
                )}
                <div className="absolute top-1 right-1 flex gap-1 z-[2]">
                  {item.media_type === "image" && (
                    <button
                      type="button"
                      onClick={() => openCropper(index)}
                      className="p-1.5 bg-background/80 rounded-full hover:bg-background transition-colors"
                      title="Crop"
                    >
                      <Crop className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {item.media_type === "video" && (
                    <button
                      type="button"
                      onClick={() => openCoverPicker(index)}
                      className="p-1.5 bg-background/80 rounded-full hover:bg-background transition-colors"
                      title={item.coverUrl ? "Change cover photo" : "Add cover photo"}
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
                {item.media_type === "video" && (
                  <div className="absolute bottom-1 left-1 z-[2]">
                    {item.coverUrl ? (
                      <span className="text-[10px] font-medium bg-green-500/80 text-white px-1.5 py-0.5 rounded-full">
                        Cover set
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium bg-white/20 text-white/80 px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                        No cover
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!discussionMode && (
          <div className="flex flex-wrap gap-2 mt-4">
            {AVAILABLE_TAGS.map((tag) => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {discussionMode && (
          <div className="flex items-center gap-2 mt-4 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5">
            <Share2 className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="share-to-feed" className="flex-1 text-sm text-muted-foreground cursor-pointer">
              Also share to my feed
            </Label>
            <Switch
              id="share-to-feed"
              checked={shareToFeed}
              onCheckedChange={setShareToFeed}
            />
          </div>
        )}

        <div className="flex items-center justify-between mt-4">
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverSelect}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={media.length >= 10}
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              Media
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {content.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {content.length}/5000
              </span>
            )}
            <Button
              onClick={handleSubmit}
              disabled={!content.trim() && media.length === 0}
            >
              Post
            </Button>
          </div>
        </div>
      </CardContent>

      {cropperIndex !== null && media[cropperIndex] && (
        <MediaCropper
          open={cropperOpen}
          onOpenChange={(open) => {
            setCropperOpen(open);
            if (!open) setCropperIndex(null);
          }}
          imageSrc={media[cropperIndex].url}
          onCropComplete={handleCropComplete}
        />
      )}
    </Card>
  );
}
