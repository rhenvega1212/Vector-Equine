"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export function CoachingNotesEditor({
  sessionId,
  initialSummary,
  initialHomework,
}: {
  sessionId: string;
  initialSummary: string | null;
  initialHomework: string | null;
}) {
  const { toast } = useToast();
  const [summary, setSummary] = useState(initialSummary ?? "");
  const [homework, setHomework] = useState(initialHomework ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/train/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: summary.trim() || null,
          homework: homework.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Could not save notes",
          description: typeof data.error === "string" ? data.error : "Try again",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Coaching notes saved" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-gold/20 bg-[#131C31] p-4 space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
          Coaching notes
        </p>
        <p className="mt-1 text-xs text-cream/50">
          Summary and homework for this rider — scores stay theirs.
        </p>
      </div>
      <div className="space-y-2">
        <label className="text-xs text-cream/60" htmlFor="coach-summary">
          Summary
        </label>
        <Textarea
          id="coach-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          className="border-gold/20 bg-navy text-cream"
          placeholder="What stood out in this ride…"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs text-cream/60" htmlFor="coach-homework">
          Homework
        </label>
        <Textarea
          id="coach-homework"
          value={homework}
          onChange={(e) => setHomework(e.target.value)}
          rows={3}
          className="border-gold/20 bg-navy text-cream"
          placeholder="What to work on next…"
        />
      </div>
      <Button
        type="button"
        className="bg-gold text-navy font-semibold hover:bg-gold-bright"
        disabled={saving}
        onClick={save}
      >
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save notes
      </Button>
    </section>
  );
}
