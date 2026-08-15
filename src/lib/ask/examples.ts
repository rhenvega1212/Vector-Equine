import type { RideMoment } from "@/lib/train/ride-moments";
import type { AskExample } from "@/lib/ask/types";

const FALLBACK: AskExample = {
  text: "What should I carry into the next ride?",
};

/**
 * Two idle example questions from this ride's moments / title.
 * Never returns an empty list.
 */
export function buildAskExamples(opts: {
  title: string | null;
  moments: RideMoment[];
  homework: string | null;
}): AskExample[] {
  const out: AskExample[] = [];
  const watch = opts.moments.find((m) => m.tone === "watch");
  const good = opts.moments.find((m) => m.tone === "good");

  if (watch?.text.trim()) {
    const clip = watch.text.trim().replace(/\.$/, "");
    const short =
      clip.length > 72 ? `${clip.slice(0, 69).replace(/\s+\S*$/, "")}…` : clip;
    out.push({ text: `Why did that happen — “${short}”?` });
  }

  if (good?.text.trim() && out.length < 2) {
    out.push({ text: "Has that feel been getting clearer across rides?" });
  }

  if (opts.homework?.trim() && out.length < 2) {
    out.push({ text: "How do I work the homework without overdoing it?" });
  }

  if (opts.title?.trim() && out.length < 2) {
    out.push({
      text: `What mattered most in “${opts.title.trim()}”?`,
    });
  }

  if (out.length === 0) out.push(FALLBACK);
  if (out.length === 1) {
    out.push({ text: "What did my trainer keep coming back to?" });
  }

  return out.slice(0, 2);
}
