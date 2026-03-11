"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  createTrainingSessionSchema,
  type CreateTrainingSessionInput,
  SESSION_TYPE_LABELS,
  QUICK_RATING_KEYS,
  QUICK_RATING_LABELS,
} from "@/lib/validations/training-session";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Video, Link as LinkIcon, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const MAX_VIDEO_MINUTES = 5;
const MAX_VIDEO_SECONDS = MAX_VIDEO_MINUTES * 60;

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read video"));
    };
    video.src = url;
  });
}

interface HorseOption {
  id: string;
  name: string;
  barn_name?: string | null;
}

interface SessionFormProps {
  mode: "create" | "edit";
  sessionId?: string;
  defaultValues?: Partial<CreateTrainingSessionInput> & { session_date?: string };
}

export function SessionForm({ mode, sessionId, defaultValues }: SessionFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedHorseId = searchParams?.get("horse_id") || undefined;
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [horses, setHorses] = useState<HorseOption[]>([]);
  const [videoMode, setVideoMode] = useState<"none" | "link" | "upload">("none");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUploadPath, setVideoUploadPath] = useState<string | null>(null);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateTrainingSessionInput>({
    resolver: zodResolver(createTrainingSessionSchema),
    defaultValues: {
      session_date: defaultValues?.session_date || new Date().toISOString().split("T")[0],
      horse_id: defaultValues?.horse_id ?? undefined,
      horse: defaultValues?.horse ?? "",
      session_title: defaultValues?.session_title ?? "",
      session_type: defaultValues?.session_type || "flat_ride",
      duration_minutes: defaultValues?.duration_minutes ?? undefined,
      location: defaultValues?.location ?? "",
      overall_feel: defaultValues?.overall_feel ?? 5,
      competition_prep: defaultValues?.competition_prep ?? false,
      focused_goal_session: defaultValues?.focused_goal_session ?? false,
      notes: defaultValues?.notes ?? "",
      exercises: defaultValues?.exercises ?? "",
      video_link_url: defaultValues?.video_link_url ?? "",
      ...defaultValues,
    },
  });

  const horseId = watch("horse_id");
  const videoLinkUrl = watch("video_link_url");

  useEffect(() => {
    fetch("/api/train/horses")
      .then((r) => r.json())
      .then((data) => {
        const list = data.horses || [];
        setHorses(list);
        if (mode === "create" && list.length > 0 && !defaultValues?.horse_id && !preselectedHorseId) {
          if (list.length === 1) {
            setValue("horse_id", list[0].id);
            setValue("horse", "");
          }
        } else if (preselectedHorseId && list.some((h: HorseOption) => h.id === preselectedHorseId)) {
          setValue("horse_id", preselectedHorseId);
          setValue("horse", "");
        }
      })
      .catch(() => {});
  }, [mode, preselectedHorseId, defaultValues?.horse_id, setValue]);

  useEffect(() => {
    if (defaultValues?.video_link_url) setVideoMode("link");
    if (defaultValues?.video_upload_path) setVideoMode("upload");
  }, [defaultValues?.video_link_url, defaultValues?.video_upload_path]);

  const overallFeel = watch("overall_feel") ?? 5;

  async function handleVideoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setVideoUploadError(null);
    setVideoFile(null);
    setVideoUploadPath(null);
    setValue("video_upload_path", undefined);
    setValue("video_link_url", "");
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setVideoUploadError("Please select a video file (e.g. MP4, WebM).");
      return;
    }
    try {
      const duration = await getVideoDuration(file);
      if (duration > MAX_VIDEO_SECONDS) {
        setVideoUploadError(`Video must be ${MAX_VIDEO_MINUTES} minutes or less. This video is ${Math.ceil(duration / 60)} min.`);
        e.target.value = "";
        return;
      }
      setVideoFile(file);
    } catch {
      setVideoUploadError("Could not read video duration.");
      e.target.value = "";
    }
  }

  async function uploadVideoAndGetPath(): Promise<string | null> {
    if (!videoFile) return null;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const ext = videoFile.name.split(".").pop() || "mp4";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("session-videos").upload(path, videoFile, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      toast({ title: "Video upload failed", description: error.message, variant: "destructive" });
      return null;
    }
    return path;
  }

  async function onSubmit(data: CreateTrainingSessionInput) {
    setIsLoading(true);
    setVideoUploadError(null);
    try {
      let finalVideoPath: string | null = null;
      if (videoMode === "upload" && videoFile) {
        finalVideoPath = await uploadVideoAndGetPath();
        if (finalVideoPath === null) {
          setIsLoading(false);
          return;
        }
      }

      const payload: Record<string, unknown> = {
        ...data,
        duration_minutes: data.duration_minutes != null && Number.isFinite(data.duration_minutes) ? data.duration_minutes : null,
        video_link_url: videoMode === "link" ? (data.video_link_url || null) : null,
        video_upload_path: videoMode === "upload"
          ? (finalVideoPath ?? (mode === "edit" ? defaultValues?.video_upload_path : null) ?? null)
          : null,
      };
      QUICK_RATING_KEYS.forEach((k) => {
        const v = payload[k];
        if (v === 0 || v === undefined) payload[k] = null;
      });
      if (payload.horse_id && horses.length > 0) {
        payload.horse = null;
      }

      if (mode === "create") {
        const res = await fetch("/api/train/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const e = await res.json();
          throw new Error(typeof e.error === "string" ? e.error : e.error?.message || "Failed to create session");
        }
        const session = await res.json();
        toast({ title: "Session logged" });
        router.push(`/train/sessions/${session.id}`);
      } else if (sessionId) {
        const res = await fetch(`/api/train/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const e = await res.json();
          throw new Error(typeof e.error === "string" ? e.error : e.error?.message || "Failed to update session");
        }
        toast({ title: "Session updated" });
        router.push(`/train/sessions/${sessionId}`);
      }
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  const hasHorses = horses.length > 0;

  return (
    <div className="max-w-2xl space-y-6">
      <Link href={mode === "edit" ? `/train/sessions/${sessionId}` : "/train/sessions"}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </Link>

      <Card className="border-cyan-400/20">
        <CardHeader>
          <CardTitle>{mode === "create" ? "Log a session" : "Edit session"}</CardTitle>
          <p className="text-sm text-muted-foreground">Quick and clear. Select your horse and add details.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Horse */}
            <div className="space-y-2">
              <Label>Horse *</Label>
              {hasHorses ? (
                <Select
                  value={horseId || ""}
                  onValueChange={(v) => {
                    setValue("horse_id", v || undefined);
                    setValue("horse", "");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select horse" />
                  </SelectTrigger>
                  <SelectContent>
                    {horses.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.barn_name?.trim() ? `${h.name} (“${h.barn_name}”)` : h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-2">
                  <Input id="horse" placeholder="Horse name" {...register("horse")} />
                  <p className="text-xs text-muted-foreground">
                    <Link href="/train/horses/new" className="text-cyan-400 hover:text-cyan-300">Add a horse profile</Link> to track sessions by horse.
                  </p>
                </div>
              )}
              {(errors.horse_id || errors.horse) && (
                <p className="text-sm text-destructive">{(errors as Record<string, { message?: string }>).horse_id?.message || (errors as Record<string, { message?: string }>).horse?.message || "Select or enter a horse."}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="session_date">Date *</Label>
                <Input id="session_date" type="date" {...register("session_date")} />
                {errors.session_date && <p className="text-sm text-destructive">{errors.session_date.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="session_title">Session title (optional)</Label>
                <Input id="session_title" placeholder="e.g. Morning flat" {...register("session_title")} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Session type *</Label>
                <Select
                  onValueChange={(v) => setValue("session_type", v as CreateTrainingSessionInput["session_type"])}
                  value={watch("session_type")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SESSION_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration_minutes">Duration (min, optional)</Label>
                <Input id="duration_minutes" type="number" min={0} max={600} placeholder="45" {...register("duration_minutes", { valueAsNumber: true })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location (optional)</Label>
              <Input id="location" placeholder="e.g. Home arena" {...register("location")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="overall_feel">Overall feel (1–10) *</Label>
              <div className="flex items-center gap-4">
                <Slider
                  id="overall_feel"
                  min={1}
                  max={10}
                  step={1}
                  value={[overallFeel]}
                  onValueChange={([v]) => setValue("overall_feel", v)}
                  className="flex-1"
                />
                <span className="text-cyan-400 font-medium w-8">{overallFeel}</span>
              </div>
            </div>

            {/* Quick ratings — tap 1–5 */}
            <div>
              <Label className="mb-3 block text-muted-foreground">Quick ratings (1–5, optional — tap to set)</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {QUICK_RATING_KEYS.map((key) => (
                  <div key={key} className="space-y-1">
                    <p className="text-xs text-muted-foreground truncate">{QUICK_RATING_LABELS[key]}</p>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setValue(key, (watch(key) === n ? undefined : n) as never)}
                          className={cn(
                            "h-8 w-8 rounded text-sm font-medium transition-colors",
                            watch(key) === n
                              ? "bg-cyan-500 text-black"
                              : "bg-muted hover:bg-muted/80 text-muted-foreground"
                          )}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="exercises">Exercises worked on (optional)</Label>
              <Textarea id="exercises" placeholder="What did you work on?" className="min-h-[60px]" {...register("exercises")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Journal</Label>
              <Textarea
                id="notes"
                placeholder="What went well, what felt hard, progress or setbacks, what to focus on next, notes for your trainer, horse behavior or mindset…"
                className="min-h-[140px] resize-y"
                {...register("notes")}
              />
            </div>

            {/* Video: link or one upload */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Video className="h-4 w-4" />
                Video (optional — one link or one upload, max 5 min)
              </Label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant={videoMode === "none" ? "default" : "outline"} size="sm" onClick={() => { setVideoMode("none"); setVideoFile(null); setVideoUploadPath(null); setVideoUploadError(null); setValue("video_link_url", ""); setValue("video_upload_path", undefined); }}>
                  None
                </Button>
                <Button type="button" variant={videoMode === "link" ? "default" : "outline"} size="sm" onClick={() => { setVideoMode("link"); setVideoFile(null); setVideoUploadPath(null); setValue("video_upload_path", undefined); }}>
                  <LinkIcon className="h-4 w-4 mr-1" /> Link
                </Button>
                <Button type="button" variant={videoMode === "upload" ? "default" : "outline"} size="sm" onClick={() => { setVideoMode("upload"); setValue("video_link_url", ""); }}>
                  <Upload className="h-4 w-4 mr-1" /> Upload
                </Button>
              </div>
              {videoMode === "link" && (
                <Input
                  type="url"
                  placeholder="https://..."
                  {...register("video_link_url")}
                />
              )}
              {videoMode === "upload" && (
                <div className="space-y-2">
                  <Input type="file" accept="video/*" onChange={handleVideoFileChange} className="text-sm" />
                  {videoFile && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="truncate">{videoFile.name}</span>
                      <Button type="button" variant="ghost" size="sm" className="shrink-0 h-7 w-7 p-0" onClick={() => { setVideoFile(null); setVideoUploadPath(null); setVideoUploadError(null); }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {videoUploadError && <p className="text-sm text-destructive">{videoUploadError}</p>}
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {mode === "create" ? "Log session" : "Save changes"}
              </Button>
              <Link href={mode === "edit" ? `/train/sessions/${sessionId}` : "/train/sessions"}>
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
