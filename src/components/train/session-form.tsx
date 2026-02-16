"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "@/lib/validations/training-session";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";

const SCORE_KEYS = ["rhythm", "relaxation", "connection", "impulsion", "straightness", "collection"] as const;
const SCORE_LABELS: Record<string, string> = {
  rhythm: "Rhythm",
  relaxation: "Relaxation",
  connection: "Connection",
  impulsion: "Impulsion",
  straightness: "Straightness",
  collection: "Collection",
};

interface SessionFormProps {
  mode: "create" | "edit";
  sessionId?: string;
  defaultValues?: Partial<CreateTrainingSessionInput> & { session_date?: string };
}

export function SessionForm({ mode, sessionId, defaultValues }: SessionFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

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
      horse: defaultValues?.horse || "",
      session_type: defaultValues?.session_type || "ride",
      overall_feel: defaultValues?.overall_feel ?? 5,
      competition_prep: defaultValues?.competition_prep ?? false,
      focused_goal_session: defaultValues?.focused_goal_session ?? false,
      ...defaultValues,
    },
  });

  const overallFeel = watch("overall_feel") ?? 5;

  async function onSubmit(data: CreateTrainingSessionInput) {
    setIsLoading(true);
    try {
      const payload: Record<string, unknown> = {
        ...data,
        video_link_url: data.video_link_url || null,
      };
      SCORE_KEYS.forEach((k) => {
        const v = payload[k];
        if (v === 0 || v === undefined) payload[k] = null;
      });
      if (mode === "create") {
        const res = await fetch("/api/train/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const e = await res.json();
          throw new Error(e.error || "Failed to create session");
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
          throw new Error(e.error || "Failed to update session");
        }
        toast({ title: "Session updated" });
        router.push(`/train/sessions/${sessionId}`);
      }
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

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
          <CardTitle>{mode === "create" ? "Log a Session" : "Edit Session"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="session_date">Date *</Label>
                <Input id="session_date" type="date" {...register("session_date")} />
                {errors.session_date && (
                  <p className="text-sm text-destructive">{errors.session_date.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="horse">Horse *</Label>
                <Input id="horse" placeholder="Horse name" {...register("horse")} />
                {errors.horse && (
                  <p className="text-sm text-destructive">{errors.horse.message}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Session type *</Label>
                <Select
                  onValueChange={(v) => setValue("session_type", v as CreateTrainingSessionInput["session_type"])}
                  defaultValue={watch("session_type")}
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
                <Label htmlFor="overall_feel">Overall Feel (1–10) *</Label>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="discipline">Discipline (optional)</Label>
              <Input id="discipline" placeholder="e.g. Dressage" {...register("discipline")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="exercises">Exercises worked on (optional)</Label>
              <Textarea
                id="exercises"
                placeholder="Exercises or tags"
                className="min-h-[80px]"
                {...register("exercises")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes / Reflections (optional)</Label>
              <Textarea
                id="notes"
                placeholder="How did it go?"
                className="min-h-[100px]"
                {...register("notes")}
              />
            </div>

            <div>
              <Label className="mb-2 block">Performance scores (1–5, optional)</Label>
              <div className="space-y-3">
                {SCORE_KEYS.map((key) => (
                  <div key={key} className="flex items-center gap-4">
                    <span className="w-24 text-sm text-muted-foreground">{SCORE_LABELS[key]}</span>
                    <Slider
                      min={1}
                      max={5}
                      step={1}
                      value={[watch(key) ?? 0]}
                      onValueChange={([v]) => setValue(key, v === 0 ? undefined : v)}
                      className="flex-1"
                    />
                    <span className="w-6 text-sm">{watch(key) ?? "—"}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={watch("competition_prep")}
                  onCheckedChange={(c) => setValue("competition_prep", c === true)}
                />
                <span className="text-sm">Competition prep</span>
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={watch("focused_goal_session")}
                  onCheckedChange={(c) => setValue("focused_goal_session", c === true)}
                />
                <span className="text-sm">Focused goal session</span>
              </label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="video_link_url">Video link (optional)</Label>
              <Input
                id="video_link_url"
                type="url"
                placeholder="https://..."
                {...register("video_link_url")}
              />
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {mode === "create" ? "Log Session" : "Save Changes"}
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
