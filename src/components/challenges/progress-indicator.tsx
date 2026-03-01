"use client";

import type { LessonProgress, ModuleProgress } from "@/lib/challenges/gating";

interface LessonVariantProps {
  progress: LessonProgress;
  variant: "lesson";
}

interface ModuleVariantProps {
  progress: ModuleProgress;
  variant: "module";
}

type ProgressIndicatorProps = LessonVariantProps | ModuleVariantProps;

export function ProgressIndicator(props: ProgressIndicatorProps) {
  const percent =
    props.variant === "lesson" ? props.progress.percent : props.progress.percent;

  const label =
    props.variant === "lesson"
      ? `${(props.progress as LessonProgress).requiredComplete} of ${(props.progress as LessonProgress).requiredTotal} blocks completed`
      : `${(props.progress as ModuleProgress).lessonsComplete} of ${(props.progress as ModuleProgress).lessonsTotal} lessons completed`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {Math.round(percent)}%
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-cyan-400 transition-all duration-300"
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  );
}
