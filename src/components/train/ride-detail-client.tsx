"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  formatMomentStamp,
  videoSeekHref,
  type CarryIn,
  type RideMoment,
  type TranscriptLine,
} from "@/lib/train/ride-moments";

export function RideDetailClient({
  backHref,
  metaLine,
  title,
  whoLine,
  feelAsk = null,
  carryIn,
  moments,
  storyParagraphs = [],
  transcript,
  trainerFirstName,
  riderNote,
  videoUrl,
  videoKind = null,
  videoSyncOffsetMs = 0,
  planHref,
  askHref,
  tools,
}: {
  backHref: string;
  metaLine: string;
  title: string;
  whoLine: string;
  /** Unanswered feel — lives on debrief, identified to this ride. */
  feelAsk?: React.ReactNode;
  carryIn: CarryIn | null;
  moments: RideMoment[];
  /** Fallback when polish wrote narrative but no timed cues */
  storyParagraphs?: string[];
  transcript: TranscriptLine[];
  trainerFirstName: string | null;
  riderNote: string | null;
  videoUrl: string | null;
  /** native = Jetson/storage file; external = YouTube/Vimeo/link */
  videoKind?: "native" | "external" | null;
  /** Asset start relative to capture t0 (ms). */
  videoSyncOffsetMs?: number;
  /** Null when Plan is flagged off — the link is absent, not disabled. */
  planHref: string | null;
  askHref: string;
  tools: React.ReactNode;
}) {
  const [foldOpen, setFoldOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hasVideo = !!videoUrl?.trim();
  const isNative = videoKind === "native";

  function seekToLessonSec(atSec: number) {
    const el = videoRef.current;
    if (!el || !isNative) return;
    const mediaSec = Math.max(0, atSec - videoSyncOffsetMs / 1000);
    el.currentTime = mediaSec;
    void el.play().catch(() => undefined);
  }

  function momentSeek(atSec: number): string | null {
    if (!hasVideo) return null;
    if (isNative) return null; // handled by button + seekToLessonSec
    return videoSeekHref(videoUrl, atSec);
  }

  return (
    <div className="min-h-[70vh]">
      {/* Zone 1 — navy opening */}
      <div className="px-[26px] pt-4 sm:pt-5">
        <Link
          href={backHref}
          className="text-[11px] uppercase tracking-[0.22em] text-gold hover:text-gold-bright"
        >
          ← Rides
        </Link>

        <p className="mt-[30px] text-[10px] uppercase tracking-[0.28em] text-cream-dim">
          {metaLine}
        </p>
        <h1 className="mt-3.5 font-[Georgia,'Times_New_Roman',serif] text-[29px] font-normal leading-[1.22] text-cream">
          {title}
        </h1>
        <p className="mt-[13px] text-[12.5px] text-cream-dim">{whoLine}</p>
      </div>

      {feelAsk}

      <div className="px-[26px]">
        {carryIn ? (
          <div className="mt-[52px]">
            <p className="text-[10px] uppercase tracking-[0.28em] text-gold">
              {carryIn.label === "CARRY THIS IN"
                ? "Carry this in"
                : carryIn.label === "THE ONE THAT WORKED"
                  ? "The one that worked"
                  : "Your note"}
            </p>
            <p className="mt-[18px] font-[Georgia,'Times_New_Roman',serif] text-[27px] leading-[1.34] text-cream">
              “{carryIn.text}”
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <span className="text-[11.5px] text-cream-dim">
                {carryIn.label === "YOUR NOTE"
                  ? "You"
                  : `${carryIn.speaker}, at ${formatMomentStamp(carryIn.atSec)}`}
              </span>
              {hasVideo &&
              carryIn.label !== "YOUR NOTE" &&
              (isNative || videoSeekHref(videoUrl, carryIn.atSec)) ? (
                isNative ? (
                  <button
                    type="button"
                    onClick={() => seekToLessonSec(carryIn.atSec)}
                    className="text-[10px] uppercase tracking-[0.2em] text-gold hover:text-gold-bright"
                  >
                    ▶ Watch it
                  </button>
                ) : (
                  <a
                    href={videoSeekHref(videoUrl, carryIn.atSec)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] uppercase tracking-[0.2em] text-gold hover:text-gold-bright"
                  >
                    ▶ Watch it
                  </a>
                )
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Video — navy zone, above cream / What happened */}
        <div className={carryIn ? "mt-10" : "mt-[52px]"}>
          {hasVideo && isNative ? (
            <video
              ref={videoRef}
              src={videoUrl!}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full bg-navy-3 object-contain"
            />
          ) : hasVideo ? (
            <a
              href={videoUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="relative flex aspect-video w-full items-center justify-center bg-navy-3 transition-opacity hover:opacity-90"
              aria-label="Open ride video"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-gold text-gold">
                <span className="ml-0.5 font-[Georgia,'Times_New_Roman',serif] text-xl leading-none">
                  ▶
                </span>
              </span>
            </a>
          ) : (
            <div
              className="relative flex aspect-video w-full items-center justify-center bg-navy-3"
              aria-hidden
            >
              <p className="text-[10px] uppercase tracking-[0.28em] text-cream-dim/50">
                Video
              </p>
            </div>
          )}
        </div>

        <hr className="mb-0 mt-10 h-px border-0 bg-[var(--line)]" />
      </div>

      {/* Zone 2 — cream words */}
      <div
        className="relative mt-[74px] bg-cream pt-[46px] text-ink"
        style={{ paddingBottom: 52 }}
      >
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: "rgba(209,169,85,.28)" }}
          aria-hidden
        />
        <div
          className="absolute inset-x-0 bottom-0 h-px"
          style={{ background: "rgba(209,169,85,.28)" }}
          aria-hidden
        />

        <div className="px-[26px]">
          {moments.length > 0 ? (
            <>
              <p
                className="text-[10px] uppercase tracking-[0.28em]"
                style={{ color: "#8A6D2F" }}
              >
                What happened
              </p>
              {moments.map((m, i) => {
                const seek = momentSeek(m.atSec);
                const stamp = formatMomentStamp(m.atSec);
                return (
                  <div
                    key={`${m.atSec}-${i}`}
                    className="mt-[34px] border-l pl-4"
                    style={{
                      borderLeftColor:
                        m.tone === "good" ? "var(--good)" : "var(--watch)",
                    }}
                  >
                    {isNative && hasVideo ? (
                      <button
                        type="button"
                        onClick={() => seekToLessonSec(m.atSec)}
                        className="text-[10px] uppercase tracking-[0.2em] hover:opacity-80"
                        style={{ color: "#9A7526" }}
                      >
                        ▶ {stamp}
                      </button>
                    ) : seek ? (
                      <a
                        href={seek}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] uppercase tracking-[0.2em] hover:opacity-80"
                        style={{ color: "#9A7526" }}
                      >
                        ▶ {stamp}
                      </a>
                    ) : (
                      <span
                        className="text-[10px] uppercase tracking-[0.2em]"
                        style={{ color: "#9A7526" }}
                      >
                        {stamp}
                      </span>
                    )}
                    <p
                      className="mt-3 font-[Georgia,'Times_New_Roman',serif] text-[19.5px] leading-[1.46]"
                      style={{ color: "#1A2133" }}
                    >
                      {m.text}
                    </p>
                  </div>
                );
              })}
              <div className="h-10" />
              <hr
                className="m-0 h-px border-0"
                style={{ background: "rgba(26,33,51,.1)" }}
              />
            </>
          ) : storyParagraphs.length > 0 ? (
            <>
              <p
                className="text-[10px] uppercase tracking-[0.28em]"
                style={{ color: "#8A6D2F" }}
              >
                What happened
              </p>
              {storyParagraphs.map((p, i) => (
                <p
                  key={i}
                  className="mt-[34px] font-[Georgia,'Times_New_Roman',serif] text-[19.5px] leading-[1.46]"
                  style={{ color: "#1A2133" }}
                >
                  {p}
                </p>
              ))}
              <div className="h-10" />
              <hr
                className="m-0 h-px border-0"
                style={{ background: "rgba(26,33,51,.1)" }}
              />
            </>
          ) : null}

          {transcript.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => setFoldOpen((v) => !v)}
                className="flex w-full items-baseline justify-between py-5 text-left"
                aria-expanded={foldOpen}
              >
                <span
                  className="text-[10px] uppercase tracking-[0.28em]"
                  style={{ color: foldOpen ? "#7A5C18" : "#8A6D2F" }}
                >
                  What {trainerFirstName || "they"} said
                </span>
                <span
                  className="text-[9.5px] uppercase tracking-[0.18em]"
                  style={{ color: "#6B7183" }}
                >
                  {transcript.length} exchanges
                </span>
              </button>
              {foldOpen ? (
                <div className="pb-[22px]">
                  {transcript.map((line, i) => {
                    const atSec =
                      line.offset_ms != null
                        ? Math.floor(line.offset_ms / 1000)
                        : null;
                    return (
                      <div key={i} className="mb-[17px]">
                        <div className="flex items-baseline justify-between gap-3">
                          <p
                            className="text-[9.5px] uppercase tracking-[0.2em]"
                            style={{
                              color: line.isRider ? "#6B7183" : "#8A6D2F",
                            }}
                          >
                            {line.speaker}
                          </p>
                          {isNative && hasVideo && atSec != null ? (
                            <button
                              type="button"
                              onClick={() => seekToLessonSec(atSec)}
                              className="shrink-0 text-[9.5px] uppercase tracking-[0.18em] hover:opacity-80"
                              style={{ color: "#9A7526" }}
                            >
                              ▶ {formatMomentStamp(atSec)}
                            </button>
                          ) : null}
                        </div>
                        <p
                          className="mt-1.5 text-sm leading-[1.72]"
                          style={{
                            color: line.isRider ? "#565E70" : "#2A3040",
                          }}
                        >
                          {line.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              <hr
                className="m-0 h-px border-0"
                style={{ background: "rgba(26,33,51,.14)" }}
              />
            </>
          ) : null}

          {riderNote?.trim() ? (
            <>
              <div className="pb-3 pt-5">
                <p
                  className="text-[10px] uppercase tracking-[0.28em]"
                  style={{ color: "#8A6D2F" }}
                >
                  Your note
                </p>
              </div>
              <p
                className="text-sm leading-[1.75]"
                style={{ color: "#2A3040" }}
              >
                {riderNote.trim()}
              </p>
            </>
          ) : null}
        </div>
      </div>

      {/* Zone 3 — exits (measurements absent until sensors) */}
      <div
        className="px-[26px] pt-11"
        style={{
          paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="flex flex-col gap-[17px]">
          <Link
            href={askHref}
            className="text-[12.5px] tracking-[0.04em] text-gold hover:text-gold-bright"
          >
            Ask Vector about this ride →
          </Link>
          {planHref ? (
            <Link
              href={planHref}
              className="text-[12.5px] tracking-[0.04em] text-gold hover:text-gold-bright"
            >
              Plan tomorrow from this →
            </Link>
          ) : null}
        </div>

        <div className="mt-10">
          <button
            type="button"
            onClick={() => setToolsOpen((v) => !v)}
            className="text-[9.5px] uppercase tracking-[0.22em] text-cream-dim hover:text-cream"
            aria-expanded={toolsOpen}
          >
            {toolsOpen ? "Hide tools" : "More"}
          </button>
          {toolsOpen ? <div className="mt-4 space-y-3">{tools}</div> : null}
        </div>
      </div>
    </div>
  );
}
