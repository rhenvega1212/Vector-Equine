"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, ExternalLink } from "lucide-react";
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
  const [embedFailed, setEmbedFailed] = useState(false);

  const preventContext = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  if (!block.content) return null;

  const settings = block.settings as unknown as Partial<VideoSettings>;
  const parsed = parseVideoUrl(block.content);

  const youtubeWatchUrl: string | undefined =
    parsed.type === "youtube"
      ? `https://www.youtube.com/watch?v=${parsed.id}`
      : undefined;

  return (
    <div className="space-y-3">
      {settings?.title && (
        <h3 className="text-lg font-semibold">{settings.title}</h3>
      )}
      {settings?.description && (
        <p className="text-sm text-muted-foreground">{settings.description}</p>
      )}

      <div
        className="relative w-full overflow-hidden rounded-lg border border-border"
        onContextMenu={preventContext}
      >
        {parsed.type === "youtube" ? (
          <>
            {!embedFailed ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${parsed.id}?rel=0&modestbranding=1`}
                className="aspect-video w-full"
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="no-referrer"
                title="YouTube video"
                onError={() => setEmbedFailed(true)}
              />
            ) : null}
            {embedFailed && (
              <div className="aspect-video w-full flex flex-col items-center justify-center gap-3 bg-muted/50 rounded-lg p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Video cannot be embedded. Watch it on YouTube instead.
                </p>
                <a
                  href={youtubeWatchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-medium"
                >
                  <ExternalLink className="h-4 w-4" />
                  Watch on YouTube
                </a>
              </div>
            )}
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">
                If the player shows an error, use the link below to watch on YouTube.
              </p>
              <a
                href={youtubeWatchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 font-medium"
              >
                <ExternalLink className="h-3 w-3" />
                Watch video on YouTube
              </a>
            </div>
          </>
        ) : parsed.type === "vimeo" ? (
          <iframe
            src={`https://player.vimeo.com/video/${parsed.id}?title=0&byline=0&portrait=0`}
            className="aspect-video w-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer"
          />
        ) : (
          <video
            src={block.content}
            controls
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
            className="aspect-video w-full"
            onContextMenu={preventContext}
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
