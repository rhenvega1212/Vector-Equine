"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import type { BlockRendererProps } from "@/lib/blocks/types";
import type { VideoSettings } from "@/lib/blocks/types";

function parseVideoUrl(url: string) {
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/
  );
  if (ytMatch) return { type: "youtube" as const, id: ytMatch[1] };

  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return { type: "vimeo" as const, id: vimeoMatch[1] };

  return { type: "direct" as const, id: null };
}

export function VideoBlockRenderer({ block, isCompleted, onComplete }: BlockRendererProps) {
  if (!block.content) return null;

  const settings = block.settings as unknown as Partial<VideoSettings>;
  const parsed = parseVideoUrl(block.content);

  return (
    <div className="space-y-3">
      {settings?.title && (
        <h3 className="text-lg font-semibold">{settings.title}</h3>
      )}
      {settings?.description && (
        <p className="text-sm text-muted-foreground">{settings.description}</p>
      )}

      <div className="relative w-full overflow-hidden rounded-lg border border-border">
        {parsed.type === "youtube" ? (
          <iframe
            src={`https://www.youtube.com/embed/${parsed.id}`}
            className="aspect-video w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : parsed.type === "vimeo" ? (
          <iframe
            src={`https://player.vimeo.com/video/${parsed.id}`}
            className="aspect-video w-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video
            src={block.content}
            controls
            className="aspect-video w-full"
          />
        )}
      </div>

      {settings?.trackCompletion && onComplete && !isCompleted && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onComplete}
          className="gap-1.5"
        >
          <CheckCircle className="h-4 w-4" />
          Mark as Watched
        </Button>
      )}

      {settings?.trackCompletion && isCompleted && (
        <p className="flex items-center gap-1.5 text-sm text-green-500">
          <CheckCircle className="h-4 w-4" />
          Watched
        </p>
      )}
    </div>
  );
}
