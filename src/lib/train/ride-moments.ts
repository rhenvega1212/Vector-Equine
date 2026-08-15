import { formatOffset } from "@/lib/capture/summary";
import { parseCoachCardSummary } from "@/lib/capture/transcript-cleanup";

export type RideMoment = {
  atSec: number;
  tone: "good" | "watch";
  text: string;
};

export type CarryIn = {
  text: string;
  speaker: string;
  atSec: number;
  label: "CARRY THIS IN" | "THE ONE THAT WORKED" | "YOUR NOTE";
};

export type TranscriptLine = {
  speaker: string;
  text: string;
  isRider?: boolean;
  offset_ms?: number;
};

type TimelineSeg = {
  offset_ms: number;
  speaker: string;
  text: string;
  rider_highlight?: boolean;
  featured_quote?: boolean;
};

/**
 * Moments + carry-in from transcript emphasis:
 * coach-card corrections/keeps (from polish), featured trainer lines, rider highlights.
 */
export function deriveRideMoments(opts: {
  summary: string | null | undefined;
  timeline: TimelineSeg[];
  trainerName?: string | null;
  riderNote?: string | null;
}): { moments: RideMoment[]; carryIn: CarryIn | null } {
  const parsed = parseCoachCardSummary(opts.summary);
  const moments: RideMoment[] = [];
  const seen = new Set<string>();

  const push = (m: RideMoment) => {
    const key = `${m.atSec}|${m.text.slice(0, 40)}`;
    if (seen.has(key) || !m.text.trim()) return;
    seen.add(key);
    moments.push(m);
  };

  for (const c of parsed.corrections) {
    push({
      atSec: Math.floor(c.offset_ms / 1000),
      tone: "watch",
      text: c.text.trim(),
    });
  }
  for (const k of parsed.keeps) {
    push({
      atSec: Math.floor(k.offset_ms / 1000),
      tone: "good",
      text: k.text.trim(),
    });
  }

  for (const s of opts.timeline) {
    if (s.speaker === "trainer" && s.featured_quote) {
      push({
        atSec: Math.floor(s.offset_ms / 1000),
        tone: "watch",
        text: s.text.trim(),
      });
    }
    if (s.rider_highlight) {
      push({
        atSec: Math.floor(s.offset_ms / 1000),
        tone: "good",
        text: s.text.trim(),
      });
    }
  }

  moments.sort((a, b) => a.atSec - b.atSec);

  const trainerFirst =
    (opts.trainerName || "Trainer").trim().split(/\s+/)[0] || "Trainer";

  let carryIn: CarryIn | null = null;
  const firstCorrection = parsed.corrections[0];
  const firstFeatured = opts.timeline.find(
    (s) => s.speaker === "trainer" && s.featured_quote && s.text.trim()
  );
  const firstGood = moments.find((m) => m.tone === "good");

  if (firstCorrection?.text.trim()) {
    carryIn = {
      text: firstCorrection.text.trim(),
      speaker: trainerFirst,
      atSec: Math.floor(firstCorrection.offset_ms / 1000),
      label: "CARRY THIS IN",
    };
  } else if (firstFeatured) {
    carryIn = {
      text: firstFeatured.text.trim(),
      speaker: trainerFirst,
      atSec: Math.floor(firstFeatured.offset_ms / 1000),
      label: "CARRY THIS IN",
    };
  } else if (firstGood) {
    carryIn = {
      text: firstGood.text,
      speaker: trainerFirst,
      atSec: firstGood.atSec,
      label: "THE ONE THAT WORKED",
    };
  } else if (parsed.focus?.trim()) {
    // Theme-only brief (claim teaser has focus; rider debrief was blank)
    carryIn = {
      text: parsed.focus.trim(),
      speaker: trainerFirst,
      atSec: 0,
      label: "CARRY THIS IN",
    };
  } else if (opts.riderNote?.trim()) {
    carryIn = {
      text: opts.riderNote.trim(),
      speaker: "You",
      atSec: 0,
      label: "YOUR NOTE",
    };
  }

  return { moments, carryIn };
}

export function formatMomentStamp(atSec: number): string {
  return formatOffset(atSec * 1000);
}

export function videoSeekHref(
  videoUrl: string | null | undefined,
  atSec: number
): string | null {
  if (!videoUrl?.trim()) return null;
  try {
    const u = new URL(videoUrl);
    const host = u.hostname.replace(/^www\./, "");
    if (host.includes("youtube.com") || host.includes("youtu.be")) {
      u.searchParams.set("t", String(Math.max(0, Math.floor(atSec))));
      return u.toString();
    }
    if (host.includes("vimeo.com")) {
      u.hash = `t=${Math.max(0, Math.floor(atSec))}s`;
      return u.toString();
    }
  } catch {
    /* fall through */
  }
  return `${videoUrl}#t=${Math.max(0, Math.floor(atSec))}`;
}

export function transcriptFromTimeline(
  timeline: TimelineSeg[],
  trainerName: string | null
): TranscriptLine[] {
  const trainerFirst =
    (trainerName || "Trainer").trim().split(/\s+/)[0] || "Trainer";
  return timeline
    .filter((s) => s.text.trim())
    .map((s) => {
      const isRider = s.speaker === "rider";
      return {
        speaker: isRider ? "You" : trainerFirst,
        text: s.text.trim(),
        isRider,
        offset_ms: s.offset_ms,
      };
    });
}
