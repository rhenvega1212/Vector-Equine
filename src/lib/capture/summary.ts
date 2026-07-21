/** Heuristic journal summary from transcript — no model call required for P0. */
export function summarizeCaptureTranscript(
  segments: { speaker: string; text: string; offset_ms: number }[]
): { summary: string; homework: string; exercises: string; keyPhrases: string[] } {
  const trainerLines = segments
    .filter((s) => s.speaker === "trainer" && s.text.trim())
    .map((s) => s.text.trim());

  const keyPhrases = trainerLines
    .filter((t) => t.length > 12 && t.length < 120)
    .slice(0, 8);

  const exerciseHints = trainerLines.filter((t) =>
    /circle|trot|canter|walk|halt|leg.?yield|shoulder|haunches|transition|serpentine|figure/i.test(
      t
    )
  );

  const uniqueExercises = Array.from(
    new Set(exerciseHints.map((t) => t.slice(0, 80)))
  ).slice(0, 5);

  const summary =
    trainerLines.length === 0
      ? "Comms lesson captured. Add notes after you review the timeline — alongside your trainer."
      : `Lesson captured with ${segments.length} transcript moments. Focus heard in-session: ${
          keyPhrases[0] || "see timeline"
        }.`;

  const homework =
    uniqueExercises[0] ||
    keyPhrases[0] ||
    "Carry one cue from today's lesson into your next ride — alongside your trainer.";

  const exercises =
    uniqueExercises.length > 0
      ? uniqueExercises.join("\n")
      : keyPhrases.slice(0, 3).join("\n") || "See timeline for cues";

  return { summary, homework, exercises, keyPhrases };
}

export function formatOffset(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
