"use client";

/**
 * VideoPlayer (§6.1, §6.2). Owns the <video> element and is the *single writer*
 * of the master clock: once per animation frame it pushes the current time into
 * the store. Everything else only reads it.
 *
 * If a real video is loaded it drives the clock. If none is available (offline,
 * or hardware-only sessions), a synthetic clock advances over the session
 * duration so play/pause/seek still work — the rest of the app can't tell the
 * difference, mirroring the sensor-data contract philosophy.
 */
import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useAnnotationStore } from "@/lib/annotation/store";

export function VideoPlayer({ src }: { src?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [videoOk, setVideoOk] = useState(false);
  const synthMsRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);

  const setCurrentMs = useAnnotationStore((s) => s.setCurrentMs);
  const setPlaying = useAnnotationStore((s) => s.setPlaying);

  const activeSrc = localUrl ?? src;

  // rAF master-clock loop — the only place currentMs is written.
  useEffect(() => {
    let raf = 0;
    const tick = (ts: number) => {
      const {
        isPlaying,
        playbackRate,
        durationMs,
        seekRequestMs,
        consumeSeek,
      } = useAnnotationStore.getState();
      const video = videoRef.current;
      const driving = !!video && video.readyState >= 2 && !video.error && videoOk;

      // handle a pending seek
      if (seekRequestMs != null) {
        const target = Math.min(seekRequestMs, durationMs || seekRequestMs);
        synthMsRef.current = target;
        if (driving && video) video.currentTime = target / 1000;
        setCurrentMs(target);
        consumeSeek();
      }

      const dt = lastTsRef.current == null ? 0 : ts - lastTsRef.current;
      lastTsRef.current = ts;

      if (driving && video) {
        const ms = video.currentTime * 1000;
        setCurrentMs(ms);
        if (durationMs && ms >= durationMs) {
          video.pause();
          setPlaying(false);
        }
      } else if (isPlaying) {
        synthMsRef.current += dt * playbackRate;
        if (durationMs && synthMsRef.current >= durationMs) {
          synthMsRef.current = durationMs;
          setPlaying(false);
        }
        setCurrentMs(synthMsRef.current);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [videoOk, setCurrentMs, setPlaying]);

  // reflect play/pause + rate onto a real video
  const isPlaying = useAnnotationStore((s) => s.isPlaying);
  const playbackRate = useAnnotationStore((s) => s.playbackRate);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoOk) return;
    if (isPlaying) video.play().catch(() => {});
    else video.pause();
  }, [isPlaying, videoOk]);
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = playbackRate;
  }, [playbackRate]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (localUrl) URL.revokeObjectURL(localUrl);
    setLocalUrl(URL.createObjectURL(file));
    setVideoOk(false);
  }

  useEffect(() => {
    return () => {
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [localUrl]);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-video overflow-hidden rounded-lg border border-white/10 bg-black">
        {activeSrc ? (
          <video
            ref={videoRef}
            src={activeSrc}
            className="h-full w-full object-contain"
            playsInline
            preload="auto"
            onLoadedData={() => setVideoOk(true)}
            onError={() => setVideoOk(false)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <span className="text-sm">No video — synthetic clock active</span>
            <span className="text-xs">Sensor tracks stay in sync via the master clock.</span>
          </div>
        )}
        {activeSrc && !videoOk && (
          <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-center text-[10px] text-amber-300">
            Video not loaded — using synthetic clock.
          </div>
        )}
      </div>
      <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-gold">
        <Upload className="h-3.5 w-3.5" />
        Load local video
        <input type="file" accept="video/*" className="hidden" onChange={onFile} />
      </label>
    </div>
  );
}
