"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BlockEditorProps, TrainerLinkSettings } from "@/lib/blocks/types";

export function TrainerLinkBlockEditor({ block, onUpdate }: BlockEditorProps) {
  const settings = (block.settings ?? {}) as Partial<TrainerLinkSettings>;
  const trainers = settings.trainers ?? [];

  function updateTrainers(
    updated: TrainerLinkSettings["trainers"]
  ) {
    onUpdate({ settings: { ...block.settings, trainers: updated } });
  }

  function addTrainer() {
    updateTrainers([...trainers, { trainerId: "", ctaText: "" }]);
  }

  function removeTrainer(index: number) {
    updateTrainers(trainers.filter((_, i) => i !== index));
  }

  function patchTrainer(
    index: number,
    changes: Partial<TrainerLinkSettings["trainers"][number]>
  ) {
    const updated = trainers.map((t, i) =>
      i === index ? { ...t, ...changes } : t
    );
    updateTrainers(updated);
  }

  return (
    <div className="space-y-4">
      <Label className="text-slate-300">Trainers</Label>

      {trainers.length === 0 && (
        <p className="text-xs text-slate-500">
          No trainers added yet. Click below to add one.
        </p>
      )}

      {trainers.map((trainer, i) => (
        <div
          key={i}
          className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3"
        >
          <div className="flex-1 space-y-2">
            <Input
              value={trainer.trainerId}
              onChange={(e) => patchTrainer(i, { trainerId: e.target.value })}
              placeholder="Trainer ID (UUID)"
              className="border-white/10 bg-white/[0.03] text-white placeholder:text-slate-500"
            />
            <Input
              value={trainer.ctaText ?? ""}
              onChange={(e) => patchTrainer(i, { ctaText: e.target.value })}
              placeholder="CTA text (e.g. Get feedback from Emma)"
              className="border-white/10 bg-white/[0.03] text-white placeholder:text-slate-500"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeTrainer(i)}
            className="mt-1 shrink-0 text-slate-500 hover:text-red-400"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        onClick={addTrainer}
        className="border-white/20 text-slate-300 hover:border-cyan-400 hover:text-cyan-400"
      >
        <Plus size={14} className="mr-1.5" />
        Add Trainer
      </Button>
    </div>
  );
}
