"use client";

import { useRef, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  Video,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare,
  Sparkles,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { uploadFileWithProgress } from "@/lib/uploads/storage";
import type {
  BlockRendererProps,
  SubmissionSettings,
} from "@/lib/blocks/types";

type UploadedFile = { url: string; name: string; type: string };

type SubmissionStatus =
  | "not_started"
  | "submitted"
  | "in_review"
  | "feedback_delivered"
  | "needs_resubmission";

interface SubmissionData {
  id: string;
  block_id: string;
  user_id: string;
  files: string | UploadedFile[];
  notes: string | null;
  status: SubmissionStatus;
  created_at: string;
  updated_at: string;
}

interface AiFeedback {
  id: string;
  submission_id: string;
  result_json: {
    score: number;
    feedback: string;
    strengths: string[];
    improvements: string[];
    timestamp: string;
  };
  model: string | null;
  created_at: string;
}

interface TrainerFeedback {
  id: string;
  submission_id: string;
  trainer_id: string;
  status: string;
  feedback: string | null;
  price_amount: number | null;
  turnaround_days: number | null;
  created_at: string;
  completed_at: string | null;
}

const STATUS_CONFIG: Record<
  SubmissionStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  not_started: {
    label: "Not Started",
    color: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    icon: Clock,
  },
  submitted: {
    label: "Submitted",
    color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    icon: CheckCircle2,
  },
  in_review: {
    label: "In Review",
    color: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    icon: Clock,
  },
  feedback_delivered: {
    label: "Feedback Delivered",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    icon: MessageSquare,
  },
  needs_resubmission: {
    label: "Needs Resubmission",
    color: "bg-red-500/20 text-red-400 border-red-500/30",
    icon: AlertCircle,
  },
};

function parseFiles(files: string | UploadedFile[]): UploadedFile[] {
  if (Array.isArray(files)) return files;
  try {
    return JSON.parse(files);
  } catch {
    return [];
  }
}

function acceptString(type: SubmissionSettings["submissionType"]): string {
  switch (type) {
    case "video":
      return "video/*";
    case "image":
      return "image/*";
    case "text":
      return ".txt,.md,.pdf,.doc,.docx";
    default:
      return "*";
  }
}

function fileIcon(type: string) {
  if (type.startsWith("video")) return <Video size={14} className="text-purple-400" />;
  if (type.startsWith("image")) return <ImageIcon size={14} className="text-blue-400" />;
  return <FileText size={14} className="text-slate-400" />;
}

export function SubmissionBlockRenderer({
  block,
  currentUserId,
  onComplete,
}: BlockRendererProps) {
  const settings = (block.settings ?? {}) as Partial<SubmissionSettings>;
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [trainerLoading, setTrainerLoading] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const queryKey = ["submission", block.id];

  const { data, isLoading } = useQuery<{
    submission: SubmissionData | null;
    aiFeedback: AiFeedback[];
    trainerFeedback: TrainerFeedback[];
  }>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(
        `/api/challenges/blocks/${block.id}/submit`
      );
      if (!res.ok) throw new Error("Failed to fetch submission");
      return res.json();
    },
    enabled: !!currentUserId,
  });

  const submission = data?.submission ?? null;
  const aiFeedback = data?.aiFeedback ?? [];
  const trainerFeedback = data?.trainerFeedback ?? [];
  const status: SubmissionStatus = (submission?.status as SubmissionStatus) ?? "not_started";
  const existingFiles = submission ? parseFiles(submission.files) : [];

  const canSubmit = status === "not_started" || isEditing;
  const canResubmit =
    settings.allowResubmission &&
    (status === "feedback_delivered" || status === "needs_resubmission");

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? []);
      if (selected.length === 0) return;

      const maxFiles = settings.maxFiles ?? 1;
      const remaining = maxFiles - files.length;
      const toUpload = selected.slice(0, remaining);

      setUploading(true);
      setUploadProgress(0);

      try {
        const uploaded: UploadedFile[] = [];
        for (let i = 0; i < toUpload.length; i++) {
          const file = toUpload[i];
          const path = `blocks/${block.id}/${currentUserId}/${file.name}`;
          const result = await uploadFileWithProgress(
            "submissions",
            file,
            path,
            (pct) => {
              const base = (i / toUpload.length) * 100;
              const portion = pct / toUpload.length;
              setUploadProgress(Math.round(base + portion));
            }
          );
          uploaded.push({ url: result.url, name: file.name, type: file.type });
        }
        setFiles((prev) => [...prev, ...uploaded]);
      } catch (err) {
        console.error("Upload failed:", err);
      } finally {
        setUploading(false);
        setUploadProgress(0);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [block.id, currentUserId, files.length, settings.maxFiles]
  );

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (files.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/challenges/blocks/${block.id}/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files, notes: notes || undefined }),
        }
      );
      if (!res.ok) throw new Error("Submit failed");
      setFiles([]);
      setNotes("");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey });
      onComplete?.();
    } catch (err) {
      console.error("Submit failed:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function requestAiReview() {
    setAiLoading(true);
    try {
      const res = await fetch(
        `/api/challenges/blocks/${block.id}/submit/ai-review`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("AI review request failed");
      queryClient.invalidateQueries({ queryKey });
    } catch (err) {
      console.error("AI review failed:", err);
    } finally {
      setAiLoading(false);
    }
  }

  async function requestTrainerReview(trainerId: string, priceAmount: number) {
    setTrainerLoading(trainerId);
    try {
      const res = await fetch(
        `/api/challenges/blocks/${block.id}/submit/trainer-review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trainer_id: trainerId,
            price_amount: priceAmount,
          }),
        }
      );
      if (!res.ok) throw new Error("Trainer review request failed");
      queryClient.invalidateQueries({ queryKey });
    } catch (err) {
      console.error("Trainer review failed:", err);
    } finally {
      setTrainerLoading(null);
    }
  }

  function startResubmission() {
    setFiles(existingFiles);
    setNotes(submission?.notes ?? "");
    setIsEditing(true);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[status];
  const StatusIcon = statusCfg.icon;

  return (
    <div className="space-y-5">
      {/* Instructions */}
      {settings.instructions && (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-sm leading-relaxed text-slate-300">
            {settings.instructions}
          </p>
        </div>
      )}

      {/* Status badge */}
      {status !== "not_started" && (
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={statusCfg.color}
          >
            <StatusIcon size={12} className="mr-1" />
            {statusCfg.label}
          </Badge>
        </div>
      )}

      {/* Submitted files display (when not editing) */}
      {submission && !isEditing && existingFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Submitted Files
          </p>
          <div className="space-y-1.5">
            {existingFiles.map((f, i) => (
              <a
                key={i}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300 transition-colors hover:border-white/20"
              >
                {fileIcon(f.type)}
                <span className="truncate">{f.name}</span>
              </a>
            ))}
          </div>
          {submission.notes && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              <p className="text-xs font-medium text-slate-500">Notes</p>
              <p className="mt-1 text-sm text-slate-300">{submission.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Upload area (when can submit or editing) */}
      {(canSubmit || isEditing) && (
        <div className="space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept={acceptString(settings.submissionType ?? "mixed")}
            multiple={
              (settings.maxFiles ?? 1) - files.length > 1
            }
            onChange={handleFileSelect}
            className="hidden"
          />

          {files.length < (settings.maxFiles ?? 1) && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-white/15 bg-white/[0.02] px-4 py-8 text-slate-400 transition-colors hover:border-cyan-400/40 hover:text-cyan-400 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <Upload size={24} />
              )}
              <span className="text-sm">
                {uploading
                  ? "Uploading..."
                  : `Drop files here or click to upload (${files.length}/${settings.maxFiles ?? 1})`}
              </span>
            </button>
          )}

          {uploading && (
            <Progress value={uploadProgress} className="h-1.5" />
          )}

          {files.length > 0 && (
            <div className="space-y-1.5">
              {files.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
                >
                  {fileIcon(f.type)}
                  <span className="flex-1 truncate text-sm text-slate-300">
                    {f.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="text-slate-500 transition-colors hover:text-red-400"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes (optional)..."
            rows={3}
            className="border-white/10 bg-white/[0.03] text-white placeholder:text-slate-500"
          />

          <Button
            onClick={handleSubmit}
            disabled={files.length === 0 || submitting}
            className="bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-40"
          >
            {submitting && <Loader2 size={14} className="mr-2 animate-spin" />}
            {isEditing ? "Resubmit" : "Submit"}
          </Button>
        </div>
      )}

      {/* Resubmit button */}
      {canResubmit && !isEditing && (
        <Button
          variant="outline"
          onClick={startResubmission}
          className="border-white/20 text-slate-300 hover:border-cyan-400 hover:text-cyan-400"
        >
          Resubmit
        </Button>
      )}

      {/* AI Feedback section */}
      {settings.aiFeedbackEnabled && submission && status !== "not_started" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-purple-400" />
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              AI Review
            </p>
          </div>

          {aiFeedback.length > 0 ? (
            aiFeedback.map((fb) => (
              <div
                key={fb.id}
                className="space-y-2 rounded-lg border border-purple-500/20 bg-purple-500/5 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-purple-300">
                    Score: {fb.result_json.score}/100
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(fb.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-slate-300">
                  {fb.result_json.feedback}
                </p>
                {fb.result_json.strengths?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-green-400">
                      Strengths
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {fb.result_json.strengths.map((s, i) => (
                        <li key={i} className="text-xs text-slate-400">
                          &bull; {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {fb.result_json.improvements?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-amber-400">
                      Areas for Improvement
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {fb.result_json.improvements.map((s, i) => (
                        <li key={i} className="text-xs text-slate-400">
                          &bull; {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={requestAiReview}
              disabled={aiLoading}
              className="border-purple-500/30 text-purple-300 hover:border-purple-400 hover:text-purple-200"
            >
              {aiLoading ? (
                <Loader2 size={14} className="mr-2 animate-spin" />
              ) : (
                <Sparkles size={14} className="mr-2" />
              )}
              Get AI Review
            </Button>
          )}
        </div>
      )}

      {/* Trainer Feedback section */}
      {settings.trainerOptions &&
        settings.trainerOptions.length > 0 &&
        submission &&
        status !== "not_started" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <User size={14} className="text-cyan-400" />
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Trainer Feedback
              </p>
            </div>

            {/* Existing trainer feedback */}
            {trainerFeedback
              .filter((tf) => tf.status === "complete" && tf.feedback)
              .map((tf) => (
                <div
                  key={tf.id}
                  className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-cyan-300">
                      Trainer Feedback
                    </span>
                    <span className="text-xs text-slate-500">
                      {tf.completed_at
                        ? new Date(tf.completed_at).toLocaleDateString()
                        : ""}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{tf.feedback}</p>
                </div>
              ))}

            {/* Pending trainer requests */}
            {trainerFeedback
              .filter((tf) => tf.status !== "complete")
              .map((tf) => (
                <div
                  key={tf.id}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3"
                >
                  <Clock size={14} className="text-amber-400" />
                  <span className="text-sm text-slate-400">
                    Trainer review in progress
                    {tf.turnaround_days
                      ? ` (up to ${tf.turnaround_days} days)`
                      : ""}
                  </span>
                </div>
              ))}

            {/* Request trainer buttons */}
            {settings.trainerOptions
              .filter(
                (opt) =>
                  !trainerFeedback.some(
                    (tf) => tf.trainer_id === opt.trainerId
                  )
              )
              .map((opt) => (
                <Button
                  key={opt.trainerId}
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    requestTrainerReview(opt.trainerId, opt.priceAmount)
                  }
                  disabled={trainerLoading === opt.trainerId}
                  className="border-white/20 text-slate-300 hover:border-cyan-400 hover:text-cyan-400"
                >
                  {trainerLoading === opt.trainerId ? (
                    <Loader2 size={14} className="mr-2 animate-spin" />
                  ) : (
                    <User size={14} className="mr-2" />
                  )}
                  Get Feedback
                  {opt.priceAmount > 0
                    ? ` ($${(opt.priceAmount / 100).toFixed(2)})`
                    : ""}
                  {opt.turnaroundDays
                    ? ` · ${opt.turnaroundDays}d`
                    : ""}
                </Button>
              ))}
          </div>
        )}
    </div>
  );
}
