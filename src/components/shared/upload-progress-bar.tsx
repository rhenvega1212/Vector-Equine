"use client";

import { useUploadManager, type UploadJob } from "@/lib/uploads/upload-manager";
import { CheckCircle2, AlertCircle, Loader2, X, Upload } from "lucide-react";
import { Progress } from "@/components/ui/progress";

function JobRow({ job, onDismiss }: { job: UploadJob; onDismiss: () => void }) {
  const isDone = job.status === "done";
  const isError = job.status === "error";
  const isActive = job.status === "uploading" || job.status === "creating";

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="shrink-0">
        {isDone && <CheckCircle2 className="h-5 w-5 text-green-400" />}
        {isError && <AlertCircle className="h-5 w-5 text-red-400" />}
        {isActive && <Loader2 className="h-5 w-5 text-cyan-400 animate-spin" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-sm font-medium truncate">
            {isDone
              ? "Post published!"
              : isError
                ? "Upload failed"
                : job.status === "creating"
                  ? "Finalizing post..."
                  : `Uploading ${job.completedFiles + 1} of ${job.totalFiles}`}
          </p>
          <span className="text-xs tabular-nums text-muted-foreground shrink-0">
            {job.progress}%
          </span>
        </div>

        <Progress value={job.progress} className="h-1.5" />

        {isActive && job.currentFileName && (
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {job.currentFileName}
          </p>
        )}
        {isError && job.error && (
          <p className="text-xs text-red-400 mt-1 truncate">{job.error}</p>
        )}
      </div>

      {(isDone || isError) && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 p-1 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

export function UploadProgressBar() {
  const { jobs, dismissJob } = useUploadManager();

  if (jobs.length === 0) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:w-[380px] z-50">
      <div className="rounded-xl border border-white/10 bg-background/95 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-white/[0.03]">
          <Upload className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-xs font-medium text-muted-foreground">
            {jobs.some((j) => j.status === "uploading" || j.status === "creating")
              ? "Uploading in background..."
              : "Uploads"}
          </span>
        </div>
        {jobs.map((job) => (
          <JobRow key={job.id} job={job} onDismiss={() => dismissJob(job.id)} />
        ))}
      </div>
    </div>
  );
}
