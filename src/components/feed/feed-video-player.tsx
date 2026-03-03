"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Volume2, VolumeX } from "lucide-react";

interface FeedVideoPlayerProps {
  src: string;
  thumbnailUrl?: string | null;
  className?: string;
  maxHeight?: string;
  threshold?: number;
}

let globalMuted = false;

export function FeedVideoPlayer({
  src,
  thumbnailUrl,
  className = "",
  maxHeight,
  threshold = 0.6,
}: FeedVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPlayingRef = useRef(false);
  const [muted, setMuted] = useState(globalMuted);
  const [showCover, setShowCover] = useState(!!thumbnailUrl);
  const [visible, setVisible] = useState(false);

  const play = useCallback(async () => {
    const video = videoRef.current;
    if (!video || isPlayingRef.current) return;

    video.muted = globalMuted;
    setMuted(globalMuted);
    try {
      await video.play();
      isPlayingRef.current = true;
      setShowCover(false);
    } catch {
      video.muted = true;
      setMuted(true);
      globalMuted = true;
      try {
        await video.play();
        isPlayingRef.current = true;
        setShowCover(false);
      } catch {
        // Browser still blocking — leave paused
      }
    }
  }, []);

  const pause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    isPlayingRef.current = false;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          play();
        } else {
          setVisible(false);
          pause();
        }
      },
      { threshold }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [play, pause, threshold]);

  function toggleMute(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const video = videoRef.current;
    if (!video) return;

    const next = !muted;
    video.muted = next;
    setMuted(next);
    globalMuted = next;
  }

  const videoStyle: React.CSSProperties | undefined = maxHeight
    ? { maxHeight }
    : undefined;

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center bg-black ${className}`}
    >
      {showCover && thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-contain z-[1] transition-opacity duration-300"
        />
      )}

      <video
        ref={videoRef}
        src={src}
        loop
        playsInline
        preload="metadata"
        muted={muted}
        className="block max-w-full object-contain"
        style={videoStyle}
        onPlay={() => {
          isPlayingRef.current = true;
          setShowCover(false);
        }}
        onPause={() => {
          isPlayingRef.current = false;
        }}
      />

      {visible && (
        <button
          type="button"
          onClick={toggleMute}
          className="absolute bottom-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>
      )}
    </div>
  );
}
