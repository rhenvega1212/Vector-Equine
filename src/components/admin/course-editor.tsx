"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CoverImageUpload } from "@/components/shared/cover-image-upload";
import { CourseOutline } from "./course-outline";
import { LessonBlockEditor } from "./lesson-block-editor";
import { BlockSettingsDrawer } from "./block-settings-drawer";

interface Lesson {
  id: string;
  title: string;
  sort_order: number;
  lesson_content_blocks?: { id: string }[];
}

interface Module {
  id: string;
  title: string;
  sort_order: number;
  challenge_lessons: Lesson[];
}

interface Challenge {
  id: string;
  title: string;
  description?: string;
  difficulty?: string;
  duration_days?: number;
  price_display?: string;
  cover_image_url?: string;
  status: string;
  challenge_modules: Module[];
}

interface CourseEditorProps {
  challengeId: string;
}

export function CourseEditor({ challengeId }: CourseEditorProps) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<"lesson" | "settings">("settings");
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [activeBlock, setActiveBlock] = useState<import("@/lib/blocks/types").BlockData | null>(null);

  const { data: challenge, isLoading } = useQuery<Challenge>({
    queryKey: ["admin-challenge", challengeId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/challenges/${challengeId}`);
      if (!res.ok) throw new Error("Failed to fetch challenge");
      return res.json();
    },
  });

  const [editForm, setEditForm] = useState<{
    title: string;
    description: string;
    difficulty: string;
    duration_days: string;
    price_display: string;
    cover_image_url: string;
    status: string;
  } | null>(null);

  const form = editForm ?? {
    title: challenge?.title ?? "",
    description: challenge?.description ?? "",
    difficulty: challenge?.difficulty ?? "",
    duration_days: challenge?.duration_days?.toString() ?? "",
    price_display: challenge?.price_display ?? "",
    cover_image_url: challenge?.cover_image_url ?? "",
    status: challenge?.status ?? "draft",
  };

  const setForm = (
    updater:
      | Partial<typeof form>
      | ((prev: typeof form) => Partial<typeof form>)
  ) => {
    const updates = typeof updater === "function" ? updater(form) : updater;
    setEditForm({ ...form, ...updates });
  };

  const saveMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch(`/api/admin/challenges/${challengeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save challenge");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-challenge", challengeId] });
      setEditForm(null);
    },
  });

  function handleSave() {
    saveMutation.mutate({
      title: form.title,
      description: form.description || null,
      difficulty: form.difficulty || null,
      duration_days: form.duration_days ? parseInt(form.duration_days) : null,
      price_display: form.price_display || null,
      cover_image_url: form.cover_image_url || null,
      status: form.status,
    });
  }

  function handleSelectSettings() {
    setView("settings");
    setActiveLessonId(null);
    setActiveBlock(null);
  }

  function handleSelectLesson(lessonId: string) {
    setView("lesson");
    setActiveLessonId(lessonId);
    setActiveBlock(null);
  }

  function handleDataChange() {
    queryClient.invalidateQueries({ queryKey: ["admin-challenge", challengeId] });
  }

  if (isLoading || !challenge) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-row">
      {/* Left sidebar */}
      <div className="w-72 shrink-0 overflow-y-auto border-r border-border">
        <CourseOutline
          challenge={challenge}
          activeLessonId={activeLessonId}
          onSelectLesson={handleSelectLesson}
          onSelectSettings={handleSelectSettings}
          onDataChange={handleDataChange}
        />
      </div>

      {/* Main area */}
      <div className="flex-1 overflow-y-auto">
        {view === "settings" && (
          <div className="mx-auto max-w-2xl space-y-6 p-6">
            <h2 className="text-xl font-semibold">Course Settings</h2>

            {saveMutation.isError && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                {(saveMutation.error as Error).message}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ description: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Cover Image</Label>
                <CoverImageUpload
                  value={form.cover_image_url || null}
                  onChange={(url) => setForm({ cover_image_url: url ?? "" })}
                  pathPrefix={`covers/${challengeId}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Difficulty</Label>
                  <Select
                    value={form.difficulty}
                    onValueChange={(value) => setForm({ difficulty: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Duration</Label>
                  <Input
                    value={form.duration_days}
                    onChange={(e) => setForm({ duration_days: e.target.value })}
                    placeholder="e.g. 30 days"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Price</Label>
                  <Input
                    type="number"
                    value={form.price_display}
                    onChange={(e) => setForm({ price_display: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(value) => setForm({ status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="bg-cyan-500 text-black hover:bg-cyan-400"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Settings
                </Button>
              </div>
            </div>
          </div>
        )}

        {view === "lesson" && activeLessonId && (
          <LessonBlockEditor
            lessonId={activeLessonId}
            onBlockSettingsClick={setActiveBlock}
          />
        )}

        {view === "lesson" && !activeLessonId && (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <BookOpen className="mb-3 h-10 w-10 opacity-40" />
            <p>Select a lesson to start editing</p>
          </div>
        )}
      </div>

      {/* Right drawer */}
      {activeBlock && (
        <div className="w-80 shrink-0 overflow-y-auto border-l border-border">
          <BlockSettingsDrawer
            block={activeBlock}
            onUpdate={(updates) => setActiveBlock((prev) => prev ? { ...prev, ...updates } : prev)}
            onClose={() => setActiveBlock(null)}
          />
        </div>
      )}
    </div>
  );
}
