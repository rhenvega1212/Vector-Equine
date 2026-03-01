"use client";

import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { uploadFile, isValidImageType, isValidVideoType } from "@/lib/uploads/storage";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Image as ImageIcon, X, Video, Crop } from "lucide-react";
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
}

export function CreatePost() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [content, setContent] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperIndex, setCropperIndex] = useState<number | null>(null);

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
      URL.revokeObjectURL(newMedia[index].url);
      newMedia.splice(index, 1);
      return newMedia;
    });
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

  async function handleSubmit() {
    if (!content.trim() && media.length === 0) {
      toast({
        title: "Empty post",
        description: "Please add some content or media to your post.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Get current user
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload media files
      setIsUploading(true);
      const uploadedMedia: { url: string; media_type: "image" | "video" }[] = [];

      for (const item of media) {
        if (item.file) {
          const { url } = await uploadFile(
            "post-media",
            item.file,
            `${user.id}/${Date.now()}-${item.file.name}`
          );
          uploadedMedia.push({ url, media_type: item.media_type });
        }
      }
      setIsUploading(false);

      // Create post
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          tags: selectedTags,
          media: uploadedMedia,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create post");
      }

      // Reset form
      setContent("");
      setSelectedTags([]);
      setMedia([]);

      // Invalidate all feed queries so the list updates without a page refresh
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["home-feed"] });

      toast({
        title: "Post created",
        description: "Your post has been shared!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create post. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Textarea
          placeholder="What's on your mind?"
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
                  <video
                    src={item.url}
                    className={
                      media.length === 1
                        ? "w-full max-h-[400px] rounded-lg bg-black"
                        : "w-full h-full object-cover rounded"
                    }
                    controls
                  />
                )}
                <div className="absolute top-1 right-1 flex gap-1">
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
                  <button
                    type="button"
                    onClick={() => removeMedia(index)}
                    className="p-1.5 bg-background/80 rounded-full hover:bg-background transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

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
              disabled={isSubmitting || (!content.trim() && media.length === 0)}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {isUploading ? "Uploading..." : "Posting..."}
                </>
              ) : (
                "Post"
              )}
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
