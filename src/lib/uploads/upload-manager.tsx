"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { uploadFileWithProgress, type StorageBucket } from "./storage";
import { createClient } from "@/lib/supabase/client";

interface MediaUploadItem {
  file: File;
  media_type: "image" | "video";
  coverFile?: File;
}

interface PostPayload {
  content: string;
  tags: string[];
  media: MediaUploadItem[];
  challengeId?: string;
  blockId?: string;
  isFeedVisible?: boolean;
}

export interface UploadJob {
  id: string;
  status: "uploading" | "creating" | "done" | "error";
  /** 0-100 overall progress */
  progress: number;
  totalFiles: number;
  completedFiles: number;
  currentFileName: string;
  error?: string;
}

interface UploadManagerContextValue {
  jobs: UploadJob[];
  submitPost: (payload: PostPayload) => void;
  dismissJob: (id: string) => void;
}

const UploadManagerContext = createContext<UploadManagerContextValue | null>(null);

export function useUploadManager() {
  const ctx = useContext(UploadManagerContext);
  if (!ctx) throw new Error("useUploadManager must be used within UploadManagerProvider");
  return ctx;
}

export function UploadManagerProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const jobIdCounter = useRef(0);

  const updateJob = useCallback((id: string, patch: Partial<UploadJob>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  const dismissJob = useCallback((id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);

  const submitPost = useCallback(
    (payload: PostPayload) => {
      const jobId = `upload-${++jobIdCounter.current}-${Date.now()}`;

      const totalFiles = payload.media.reduce(
        (n, m) => n + 1 + (m.coverFile ? 1 : 0),
        0
      );

      const job: UploadJob = {
        id: jobId,
        status: "uploading",
        progress: 0,
        totalFiles,
        completedFiles: 0,
        currentFileName: totalFiles > 0 ? payload.media[0]?.file.name ?? "" : "",
      };

      setJobs((prev) => [...prev, job]);

      (async () => {
        try {
          const supabase = createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) throw new Error("Not authenticated");

          const uploadedMedia: {
            url: string;
            media_type: "image" | "video";
            thumbnail_url?: string;
          }[] = [];

          let completedFiles = 0;

          const fileUploads = payload.media.map((item) => {
            return async () => {
              const filePath = `${user.id}/${Date.now()}-${item.file.name}`;

              updateJob(jobId, { currentFileName: item.file.name });

              const { url } = await uploadFileWithProgress(
                "post-media" as StorageBucket,
                item.file,
                filePath,
                (percent) => {
                  const fileWeight = 1 / totalFiles;
                  const base = completedFiles / totalFiles;
                  const overall = Math.round((base + fileWeight * (percent / 100)) * 100);
                  updateJob(jobId, { progress: Math.min(overall, 99) });
                }
              );

              completedFiles++;
              updateJob(jobId, { completedFiles });

              let thumbnailUrl: string | undefined;
              if (item.coverFile) {
                const coverPath = `${user.id}/${Date.now()}-cover-${item.coverFile.name}`;
                updateJob(jobId, { currentFileName: `Cover: ${item.coverFile.name}` });

                const coverResult = await uploadFileWithProgress(
                  "post-media" as StorageBucket,
                  item.coverFile,
                  coverPath,
                  (percent) => {
                    const fileWeight = 1 / totalFiles;
                    const base = completedFiles / totalFiles;
                    const overall = Math.round((base + fileWeight * (percent / 100)) * 100);
                    updateJob(jobId, { progress: Math.min(overall, 99) });
                  }
                );
                thumbnailUrl = coverResult.url;
                completedFiles++;
                updateJob(jobId, { completedFiles });
              }

              uploadedMedia.push({
                url,
                media_type: item.media_type,
                ...(thumbnailUrl ? { thumbnail_url: thumbnailUrl } : {}),
              });
            };
          });

          // Upload images in parallel, videos sequentially (larger files)
          const imageUploads = fileUploads.filter(
            (_, i) => payload.media[i].media_type === "image"
          );
          const videoUploads = fileUploads.filter(
            (_, i) => payload.media[i].media_type === "video"
          );

          await Promise.all([
            Promise.all(imageUploads.map((fn) => fn())),
            (async () => {
              for (const fn of videoUploads) await fn();
            })(),
          ]);

          updateJob(jobId, {
            status: "creating",
            progress: 99,
            currentFileName: "Finalizing...",
          });

          const postBody: Record<string, unknown> = {
            content: payload.content,
            tags: payload.tags,
            media: uploadedMedia,
          };

          if (payload.challengeId) postBody.challenge_id = payload.challengeId;
          if (payload.blockId) postBody.block_id = payload.blockId;
          if (payload.isFeedVisible !== undefined)
            postBody.is_feed_visible = payload.isFeedVisible;

          const res = await fetch("/api/posts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(postBody),
          });

          if (!res.ok) throw new Error("Failed to create post");

          updateJob(jobId, {
            status: "done",
            progress: 100,
            currentFileName: "",
          });

          queryClient.invalidateQueries({ queryKey: ["feed"] });
          queryClient.invalidateQueries({ queryKey: ["home-feed"] });
          if (payload.blockId) {
            queryClient.invalidateQueries({
              queryKey: ["discussion-posts", payload.blockId],
            });
          }

          toast({
            title: "Post published",
            description: "Your post is now live!",
          });

          setTimeout(() => dismissJob(jobId), 4000);
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "Upload failed";
          updateJob(jobId, {
            status: "error",
            error: message,
            currentFileName: "",
          });
          toast({
            title: "Upload failed",
            description: message,
            variant: "destructive",
          });
        }
      })();
    },
    [queryClient, toast, updateJob, dismissJob]
  );

  return (
    <UploadManagerContext.Provider value={{ jobs, submitPost, dismissJob }}>
      {children}
    </UploadManagerContext.Provider>
  );
}
