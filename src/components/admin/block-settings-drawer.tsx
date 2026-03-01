"use client";

import { useCallback } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import type {
  BlockData,
  ImageSettings,
  VideoSettings,
  DiscussionSettings,
  SubmissionSettings,
  QuizSettings,
  ChecklistSettings,
  CalloutSettings,
  FileSettings,
  DownloadSettings,
  TrainerLinkSettings,
} from "@/lib/blocks/types";
import { getBlockMeta } from "@/lib/blocks/registry";
import { Button } from "@/components/ui/button";
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

interface BlockSettingsDrawerProps {
  block: BlockData;
  onUpdate: (updates: Partial<BlockData>) => void;
  onClose: () => void;
}

export function BlockSettingsDrawer({
  block,
  onUpdate,
  onClose,
}: BlockSettingsDrawerProps) {
  const meta = getBlockMeta(block.block_type);
  const Icon = meta.icon;
  const s = block.settings as Record<string, unknown>;

  const patch = useCallback(
    (changes: Record<string, unknown>) => {
      onUpdate({ settings: { ...block.settings, ...changes } });
    },
    [block.settings, onUpdate],
  );

  return (
    <div className="w-80 shrink-0 border-l border-slate-700/50 bg-slate-900 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700/50 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <Icon className="h-4 w-4 text-slate-400" />
          {meta.label} Settings
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {/* Common settings */}
        <Section title="General">
          <ToggleRow
            label="Required"
            checked={block.is_required}
            onChange={(v) => onUpdate({ is_required: v })}
          />
          <ToggleRow
            label="Hidden (draft)"
            checked={block.is_hidden}
            onChange={(v) => onUpdate({ is_hidden: v })}
          />
          <FieldRow label="Estimated time (minutes)">
            <Input
              type="number"
              min={0}
              value={block.estimated_time ?? ""}
              onChange={(e) =>
                onUpdate({
                  estimated_time: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="h-8"
            />
          </FieldRow>
        </Section>

        {/* Type-specific settings */}
        <TypeSettings block={block} s={s} patch={patch} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Type-specific settings                                            */
/* ------------------------------------------------------------------ */

function TypeSettings({
  block,
  s,
  patch,
}: {
  block: BlockData;
  s: Record<string, unknown>;
  patch: (c: Record<string, unknown>) => void;
}) {
  switch (block.block_type) {
    case "image":
      return <ImageSettingsPanel s={s as unknown as ImageSettings} patch={patch} />;
    case "video":
      return <VideoSettingsPanel s={s as unknown as VideoSettings} patch={patch} />;
    case "discussion":
      return <DiscussionSettingsPanel s={s as unknown as DiscussionSettings} patch={patch} />;
    case "submission":
      return <SubmissionSettingsPanel s={s as unknown as SubmissionSettings} patch={patch} />;
    case "quiz":
      return <QuizSettingsPanel s={s as unknown as QuizSettings} patch={patch} />;
    case "checklist":
      return <ChecklistSettingsPanel s={s as unknown as ChecklistSettings} patch={patch} />;
    case "callout":
      return <CalloutSettingsPanel s={s as unknown as CalloutSettings} patch={patch} />;
    case "download":
    case "file":
      return <FileSettingsPanel s={s as unknown as FileSettings & DownloadSettings} patch={patch} />;
    case "trainer_link":
      return <TrainerLinkSettingsPanel s={s as unknown as TrainerLinkSettings} patch={patch} />;
    default:
      return null;
  }
}

/* ---- Image ---- */

function ImageSettingsPanel({ s, patch }: PanelProps<ImageSettings>) {
  return (
    <Section title="Image">
      <FieldRow label="Caption">
        <Input
          value={s.caption ?? ""}
          onChange={(e) => patch({ caption: e.target.value })}
          className="h-8"
        />
      </FieldRow>
      <FieldRow label="Alignment">
        <Select value={s.alignment} onValueChange={(v) => patch({ alignment: v })}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="full">Full</SelectItem>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>
      <ToggleRow
        label="Allow enlarge"
        checked={s.allowEnlarge}
        onChange={(v) => patch({ allowEnlarge: v })}
      />
    </Section>
  );
}

/* ---- Video ---- */

function VideoSettingsPanel({ s, patch }: PanelProps<VideoSettings>) {
  return (
    <Section title="Video">
      <FieldRow label="Title">
        <Input
          value={s.title ?? ""}
          onChange={(e) => patch({ title: e.target.value })}
          className="h-8"
        />
      </FieldRow>
      <FieldRow label="Description">
        <Textarea
          value={s.description ?? ""}
          onChange={(e) => patch({ description: e.target.value })}
          rows={2}
        />
      </FieldRow>
      <ToggleRow
        label="Track completion"
        checked={s.trackCompletion}
        onChange={(v) => patch({ trackCompletion: v })}
      />
    </Section>
  );
}

/* ---- Discussion ---- */

function DiscussionSettingsPanel({ s, patch }: PanelProps<DiscussionSettings>) {
  return (
    <Section title="Discussion">
      <FieldRow label="Prompt">
        <Textarea
          value={s.prompt ?? ""}
          onChange={(e) => patch({ prompt: e.target.value })}
          rows={2}
        />
      </FieldRow>
      <FieldRow label="Default sort">
        <Select value={s.sortDefault} onValueChange={(v) => patch({ sortDefault: v })}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="top">Top</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>
      <FieldRow label="Min participation">
        <Input
          type="number"
          min={0}
          value={s.minParticipation}
          onChange={(e) => patch({ minParticipation: Number(e.target.value) })}
          className="h-8"
        />
      </FieldRow>
    </Section>
  );
}

/* ---- Submission ---- */

function SubmissionSettingsPanel({ s, patch }: PanelProps<SubmissionSettings>) {
  const trainers = s.trainerOptions ?? [];

  const updateTrainer = (idx: number, field: string, value: unknown) => {
    const next = trainers.map((t, i) => (i === idx ? { ...t, [field]: value } : t));
    patch({ trainerOptions: next });
  };

  const addTrainer = () =>
    patch({
      trainerOptions: [...trainers, { trainerId: "", priceAmount: 0, turnaroundDays: 3 }],
    });

  const removeTrainer = (idx: number) =>
    patch({ trainerOptions: trainers.filter((_, i) => i !== idx) });

  return (
    <Section title="Submission">
      <FieldRow label="Submission type">
        <Select
          value={s.submissionType}
          onValueChange={(v) => patch({ submissionType: v })}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="image">Image</SelectItem>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="mixed">Mixed</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>
      <FieldRow label="Instructions">
        <Textarea
          value={s.instructions ?? ""}
          onChange={(e) => patch({ instructions: e.target.value })}
          rows={2}
        />
      </FieldRow>
      <FieldRow label="Rubric">
        <Textarea
          value={s.rubric ?? ""}
          onChange={(e) => patch({ rubric: e.target.value })}
          rows={2}
        />
      </FieldRow>
      <FieldRow label="Max files">
        <Input
          type="number"
          min={1}
          value={s.maxFiles}
          onChange={(e) => patch({ maxFiles: Number(e.target.value) })}
          className="h-8"
        />
      </FieldRow>
      <ToggleRow
        label="Allow resubmission"
        checked={s.allowResubmission}
        onChange={(v) => patch({ allowResubmission: v })}
      />
      <ToggleRow
        label="AI feedback enabled"
        checked={s.aiFeedbackEnabled}
        onChange={(v) => patch({ aiFeedbackEnabled: v })}
      />

      {/* Trainer options array */}
      <div className="space-y-2 pt-2 border-t border-slate-700/50">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-slate-400">Trainer Options</Label>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={addTrainer}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        {trainers.map((t, idx) => (
          <div key={idx} className="space-y-1.5 rounded bg-slate-800/60 p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Trainer {idx + 1}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-red-400 hover:text-red-300"
                onClick={() => removeTrainer(idx)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <Input
              placeholder="Trainer ID"
              value={t.trainerId}
              onChange={(e) => updateTrainer(idx, "trainerId", e.target.value)}
              className="h-7 text-xs"
            />
            <div className="grid grid-cols-2 gap-1.5">
              <Input
                type="number"
                placeholder="Price"
                min={0}
                value={t.priceAmount}
                onChange={(e) => updateTrainer(idx, "priceAmount", Number(e.target.value))}
                className="h-7 text-xs"
              />
              <Input
                type="number"
                placeholder="Days"
                min={1}
                value={t.turnaroundDays}
                onChange={(e) =>
                  updateTrainer(idx, "turnaroundDays", Number(e.target.value))
                }
                className="h-7 text-xs"
              />
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ---- Quiz ---- */

function QuizSettingsPanel({ s, patch }: PanelProps<QuizSettings>) {
  const questions = s.questions ?? [];

  const updateQuestion = (qi: number, field: string, value: unknown) => {
    const next = questions.map((q, i) => (i === qi ? { ...q, [field]: value } : q));
    patch({ questions: next });
  };

  const addQuestion = () =>
    patch({
      questions: [
        ...questions,
        { question: "", options: ["", ""], correctIndex: 0, explanation: "" },
      ],
    });

  const removeQuestion = (qi: number) =>
    patch({ questions: questions.filter((_, i) => i !== qi) });

  const updateOption = (qi: number, oi: number, value: string) => {
    const next = questions.map((q, i) => {
      if (i !== qi) return q;
      const opts = q.options.map((o, j) => (j === oi ? value : o));
      return { ...q, options: opts };
    });
    patch({ questions: next });
  };

  const addOption = (qi: number) => {
    const next = questions.map((q, i) => {
      if (i !== qi) return q;
      return { ...q, options: [...q.options, ""] };
    });
    patch({ questions: next });
  };

  const removeOption = (qi: number, oi: number) => {
    const next = questions.map((q, i) => {
      if (i !== qi) return q;
      const opts = q.options.filter((_, j) => j !== oi);
      const correctIndex = q.correctIndex >= opts.length ? 0 : q.correctIndex;
      return { ...q, options: opts, correctIndex };
    });
    patch({ questions: next });
  };

  return (
    <Section title="Quiz">
      <FieldRow label="Passing percent">
        <Input
          type="number"
          min={0}
          max={100}
          value={s.passingPercent}
          onChange={(e) => patch({ passingPercent: Number(e.target.value) })}
          className="h-8"
        />
      </FieldRow>

      <div className="space-y-2 pt-2 border-t border-slate-700/50">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-slate-400">Questions</Label>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={addQuestion}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        {questions.map((q, qi) => (
          <div key={qi} className="space-y-1.5 rounded bg-slate-800/60 p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Q{qi + 1}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-red-400 hover:text-red-300"
                onClick={() => removeQuestion(qi)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <Textarea
              placeholder="Question text"
              value={q.question}
              onChange={(e) => updateQuestion(qi, "question", e.target.value)}
              rows={2}
              className="text-xs"
            />

            {/* Options */}
            <div className="space-y-1">
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-1">
                  <input
                    type="radio"
                    name={`q-${qi}-correct`}
                    checked={q.correctIndex === oi}
                    onChange={() => updateQuestion(qi, "correctIndex", oi)}
                    className="accent-emerald-500"
                  />
                  <Input
                    value={opt}
                    onChange={(e) => updateOption(qi, oi, e.target.value)}
                    className="h-7 text-xs flex-1"
                    placeholder={`Option ${oi + 1}`}
                  />
                  {q.options.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0 text-red-400 hover:text-red-300"
                      onClick={() => removeOption(qi, oi)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => addOption(qi)}
              >
                <Plus className="h-3 w-3 mr-1" /> Option
              </Button>
            </div>

            <Input
              placeholder="Explanation (optional)"
              value={q.explanation ?? ""}
              onChange={(e) => updateQuestion(qi, "explanation", e.target.value)}
              className="h-7 text-xs"
            />
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ---- Checklist ---- */

function ChecklistSettingsPanel({ s, patch }: PanelProps<ChecklistSettings>) {
  const items = s.items ?? [];

  const updateItem = (idx: number, field: string, value: unknown) => {
    const next = items.map((it, i) => (i === idx ? { ...it, [field]: value } : it));
    patch({ items: next });
  };

  const addItem = () => patch({ items: [...items, { label: "", required: false }] });

  const removeItem = (idx: number) =>
    patch({ items: items.filter((_, i) => i !== idx) });

  return (
    <Section title="Checklist">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-slate-400">Items</Label>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={addItem}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {items.map((it, idx) => (
        <div key={idx} className="flex items-center gap-1.5 rounded bg-slate-800/60 p-2">
          <Input
            value={it.label}
            onChange={(e) => updateItem(idx, "label", e.target.value)}
            className="h-7 text-xs flex-1"
            placeholder="Item label"
          />
          <Switch
            checked={it.required}
            onCheckedChange={(v) => updateItem(idx, "required", v)}
            className="scale-75"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0 text-red-400 hover:text-red-300"
            onClick={() => removeItem(idx)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </Section>
  );
}

/* ---- Callout ---- */

function CalloutSettingsPanel({ s, patch }: PanelProps<CalloutSettings>) {
  return (
    <Section title="Callout">
      <FieldRow label="Callout type">
        <Select
          value={s.calloutType}
          onValueChange={(v) => patch({ calloutType: v })}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tip">Tip</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="key_point">Key Point</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>
    </Section>
  );
}

/* ---- File / Download ---- */

function FileSettingsPanel({
  s,
  patch,
}: PanelProps<FileSettings & DownloadSettings>) {
  return (
    <Section title="File">
      <FieldRow label="Label">
        <Input
          value={s.label ?? ""}
          onChange={(e) => patch({ label: e.target.value })}
          className="h-8"
        />
      </FieldRow>
      <FieldRow label="Description">
        <Textarea
          value={s.description ?? ""}
          onChange={(e) => patch({ description: e.target.value })}
          rows={2}
        />
      </FieldRow>
    </Section>
  );
}

/* ---- Trainer Link ---- */

function TrainerLinkSettingsPanel({ s, patch }: PanelProps<TrainerLinkSettings>) {
  const trainers = s.trainers ?? [];

  const updateTrainer = (idx: number, field: string, value: string) => {
    const next = trainers.map((t, i) => (i === idx ? { ...t, [field]: value } : t));
    patch({ trainers: next });
  };

  const addTrainer = () =>
    patch({ trainers: [...trainers, { trainerId: "", ctaText: "" }] });

  const removeTrainer = (idx: number) =>
    patch({ trainers: trainers.filter((_, i) => i !== idx) });

  return (
    <Section title="Trainer Link">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-slate-400">Trainers</Label>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={addTrainer}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {trainers.map((t, idx) => (
        <div key={idx} className="space-y-1.5 rounded bg-slate-800/60 p-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Trainer {idx + 1}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-red-400 hover:text-red-300"
              onClick={() => removeTrainer(idx)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          <Input
            placeholder="Trainer ID"
            value={t.trainerId}
            onChange={(e) => updateTrainer(idx, "trainerId", e.target.value)}
            className="h-7 text-xs"
          />
          <Input
            placeholder="CTA text"
            value={t.ctaText ?? ""}
            onChange={(e) => updateTrainer(idx, "ctaText", e.target.value)}
            className="h-7 text-xs"
          />
        </div>
      ))}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared primitives                                                 */
/* ------------------------------------------------------------------ */

type PanelProps<T> = { s: T; patch: (c: Record<string, unknown>) => void };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h4>
      {children}
    </div>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-slate-400">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs text-slate-400">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
