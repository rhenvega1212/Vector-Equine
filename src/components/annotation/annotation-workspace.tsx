"use client";

/**
 * AnnotationWorkspace (§6.1): the root of the labeling tool. Assembles the
 * (mock) session client-side, boots the store, and lays out the video, the
 * shared timeline, the transport controls and the inspector.
 *
 * Real sessions will hydrate the same store from the DB + sensor time-series
 * store behind the identical shapes.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { assembleSession, getDemoSpec } from "@/lib/annotation/demo";
import { useAnnotationStore } from "@/lib/annotation/store";
import { buildExportBundle, signalsToCsv } from "@/lib/annotation/export/bundle";
import { VideoPlayer } from "./video-player";
import { Timeline } from "./timeline";
import { TransportControls } from "./transport-controls";
import { AnnotationInspector } from "./annotation-inspector";

function downloadText(filename: string, text: string, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AnnotationWorkspace({
  specId,
  authorId,
}: {
  specId: string;
  authorId: string;
}) {
  const spec = getDemoSpec(specId);
  const assembled = useMemo(() => (spec ? assembleSession(spec) : null), [spec]);
  const [ready, setReady] = useState(false);

  const initSession = useAnnotationStore((s) => s.initSession);
  const loadAnnotations = useAnnotationStore((s) => s.loadAnnotations);
  const togglePlay = useAnnotationStore((s) => s.togglePlay);
  const focusSignalIds = useAnnotationStore((s) => s.focusSignalIds);
  const setFocus = useAnnotationStore((s) => s.setFocus);
  const session = useAnnotationStore((s) => s.session);

  useEffect(() => {
    if (!assembled) return;
    initSession(assembled.session, assembled.series, authorId);
    loadAnnotations().finally(() => setReady(true));
  }, [assembled, authorId, initSession, loadAnnotations]);

  // spacebar toggles play, unless typing
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay]);

  function handleExport() {
    const state = useAnnotationStore.getState();
    if (!state.session || !state.sync) return;
    const bundle = buildExportBundle(
      state.session,
      state.series,
      state.annotations,
      state.sync
    );
    const id = state.session.id;
    downloadText(`${id}.meta.json`, JSON.stringify(bundle.meta, null, 2), "application/json");
    downloadText(
      `${id}.annotations.json`,
      JSON.stringify(bundle.annotations, null, 2),
      "application/json"
    );
    downloadText(`${id}.signals.csv`, signalsToCsv(bundle.signals), "text/csv");
  }

  if (!spec || !assembled) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Unknown session.</p>
        <Link href="/annotate" className="text-gold hover:underline">
          Back to sessions
        </Link>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1600px] space-y-3 p-3 sm:p-4">
        {/* header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Link href="/annotate">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-semibold">{assembled.session.title}</h1>
              <p className="text-xs text-muted-foreground">
                {assembled.session.discipline} · {assembled.session.sensors.length}{" "}
                sensors ·{" "}
                {assembled.session.sensors.reduce(
                  (n, s) => n + s.signals.length,
                  0
                )}{" "}
                signals · {assembled.session.sensors[0]?.sampleRateHz}Hz
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {focusSignalIds && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFocus(null)}
                className="gap-1"
              >
                <Crosshair className="h-3.5 w-3.5" />
                Clear focus ({focusSignalIds.length})
              </Button>
            )}
            <Button
              size="sm"
              className="gap-1 bg-gold text-navy hover:bg-gold/90"
              onClick={handleExport}
            >
              <Download className="h-4 w-4" />
              Export bundle
            </Button>
          </div>
        </div>

        {/* main grid */}
        <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
          <div className="space-y-3">
            <VideoPlayer src={assembled.session.videoAssetUrl} />
            <TransportControls />
            {ready && session ? (
              <Timeline />
            ) : (
              <div className="flex h-40 items-center justify-center rounded-lg border border-white/10 bg-navy text-sm text-muted-foreground">
                Loading engine…
              </div>
            )}
          </div>
          <div className="lg:h-[calc(100vh-120px)] lg:sticky lg:top-3">
            <AnnotationInspector />
          </div>
        </div>

        <p className="text-center text-[10px] text-muted-foreground">
          Space = play/pause · drag a track to annotate · wheel = zoom ·
          shift+wheel = pan · click ruler to seek
        </p>
      </div>
    </div>
  );
}
