"use client";

import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BlockEditorProps, SubmissionSettings } from "@/lib/blocks/types";

const SUBMISSION_TYPES = [
  { value: "video", label: "Video" },
  { value: "image", label: "Image" },
  { value: "text", label: "Text" },
  { value: "mixed", label: "Mixed (any file type)" },
] as const;

export function SubmissionBlockEditor({ block, onUpdate }: BlockEditorProps) {
  const settings = (block.settings ?? {}) as Partial<SubmissionSettings>;

  function patch(changes: Partial<SubmissionSettings>) {
    onUpdate({ settings: { ...block.settings, ...changes } });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label className="text-slate-300">Submission Type</Label>
        <Select
          value={settings.submissionType ?? "mixed"}
          onValueChange={(v) =>
            patch({
              submissionType: v as SubmissionSettings["submissionType"],
            })
          }
        >
          <SelectTrigger className="border-white/10 bg-white/[0.03] text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUBMISSION_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-slate-300">Instructions</Label>
        <Textarea
          value={settings.instructions ?? ""}
          onChange={(e) => patch({ instructions: e.target.value })}
          placeholder="Describe what students should submit..."
          rows={4}
          className="border-white/10 bg-white/[0.03] text-white placeholder:text-slate-500"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-slate-300">Rubric (optional)</Label>
        <Textarea
          value={settings.rubric ?? ""}
          onChange={(e) => patch({ rubric: e.target.value })}
          placeholder="Grading criteria or rubric..."
          rows={3}
          className="border-white/10 bg-white/[0.03] text-white placeholder:text-slate-500"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-slate-300">Max Files</Label>
        <Input
          type="number"
          min={1}
          max={10}
          value={settings.maxFiles ?? 1}
          onChange={(e) =>
            patch({ maxFiles: Math.min(10, Math.max(1, Number(e.target.value))) })
          }
          className="w-24 border-white/10 bg-white/[0.03] text-white"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
        <Label className="text-sm text-slate-300">Allow Resubmission</Label>
        <Switch
          checked={settings.allowResubmission ?? false}
          onCheckedChange={(v) => patch({ allowResubmission: !!v })}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
        <Label className="text-sm text-slate-300">AI Feedback Enabled</Label>
        <Switch
          checked={settings.aiFeedbackEnabled ?? false}
          onCheckedChange={(v) => patch({ aiFeedbackEnabled: !!v })}
        />
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
        <Info size={14} className="shrink-0 text-slate-500" />
        <p className="text-xs text-slate-500">
          Configure trainers in block settings (settings drawer).
        </p>
      </div>
    </div>
  );
}
