"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Loader2,
  Save,
  Eye,
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  BookOpen,
  FileText,
  Image as ImageIcon,
  Video,
  File,
} from "lucide-react";

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

interface Module {
  id: string;
  title: string;
  description?: string;
  sort_order: number;
  challenge_lessons: Lesson[];
}

interface Lesson {
  id: string;
  title: string;
  description?: string;
  requires_submission: boolean;
  sort_order: number;
  lesson_content_blocks: ContentBlock[];
  assignments: Assignment[];
}

interface ContentBlock {
  id: string;
  block_type: "rich_text" | "image" | "video" | "file";
  content?: string;
  file_name?: string;
  sort_order: number;
}

interface Assignment {
  id: string;
  title: string;
  instructions?: string;
  submission_type: string;
}

interface ChallengeEditorProps {
  challenge: Challenge;
}

export function ChallengeEditor({ challenge: initialChallenge }: ChallengeEditorProps) {
  const router = useRouter();
  const [challenge, setChallenge] = useState(initialChallenge);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDialog, setActiveDialog] = useState<string | null>(null);

  // Form state for editing
  const [editForm, setEditForm] = useState({
    title: challenge.title,
    description: challenge.description || "",
    difficulty: challenge.difficulty || "",
    duration_days: challenge.duration_days?.toString() || "",
    price_display: challenge.price_display || "",
    cover_image_url: challenge.cover_image_url || "",
    status: challenge.status,
  });

  async function saveChallenge() {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/challenges/${challenge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description || null,
          difficulty: editForm.difficulty || null,
          duration_days: editForm.duration_days ? parseInt(editForm.duration_days) : null,
          price_display: editForm.price_display || null,
          cover_image_url: editForm.cover_image_url || null,
          status: editForm.status,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to save challenge");
      }

      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function addModule() {
    try {
      const response = await fetch(`/api/admin/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge_id: challenge.id,
          title: "New Module",
          sort_order: challenge.challenge_modules.length,
        }),
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to add module:", err);
    }
  }

  async function deleteModule(moduleId: string) {
    if (!confirm("Delete this module and all its lessons?")) return;

    try {
      await fetch(`/api/admin/modules/${moduleId}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      console.error("Failed to delete module:", err);
    }
  }

  async function addLesson(moduleId: string, lessonCount: number) {
    try {
      const response = await fetch(`/api/admin/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module_id: moduleId,
          title: "New Lesson",
          sort_order: lessonCount,
        }),
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to add lesson:", err);
    }
  }

  async function deleteLesson(lessonId: string) {
    if (!confirm("Delete this lesson?")) return;

    try {
      await fetch(`/api/admin/lessons/${lessonId}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      console.error("Failed to delete lesson:", err);
    }
  }

  async function addContentBlock(lessonId: string, blockType: string, blockCount: number) {
    try {
      const response = await fetch(`/api/admin/content-blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lesson_id: lessonId,
          block_type: blockType,
          content: blockType === "rich_text" ? "Enter your content here..." : "",
          sort_order: blockCount,
        }),
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to add content block:", err);
    }
  }

  async function deleteContentBlock(blockId: string) {
    try {
      await fetch(`/api/admin/content-blocks/${blockId}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      console.error("Failed to delete content block:", err);
    }
  }

  function getBlockIcon(type: string) {
    switch (type) {
      case "rich_text": return <FileText className="h-4 w-4" />;
      case "image": return <ImageIcon className="h-4 w-4" />;
      case "video": return <Video className="h-4 w-4" />;
      case "file": return <File className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Edit Challenge</h1>
          <p className="text-muted-foreground">
            {challenge.title}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/challenges">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <Link href={`/challenges/${challenge.id}`}>
            <Button variant="outline">
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Challenge Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Challenge Details</span>
            <Badge variant={editForm.status === "published" ? "default" : "secondary"}>
              {editForm.status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Difficulty</Label>
              <Select
                value={editForm.difficulty}
                onValueChange={(value) => setEditForm({ ...editForm, difficulty: value })}
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
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Duration (days)</Label>
              <Input
                type="number"
                value={editForm.duration_days}
                onChange={(e) => setEditForm({ ...editForm, duration_days: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Price Display</Label>
              <Input
                value={editForm.price_display}
                onChange={(e) => setEditForm({ ...editForm, price_display: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Cover Image URL</Label>
              <Input
                value={editForm.cover_image_url}
                onChange={(e) => setEditForm({ ...editForm, cover_image_url: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-3">
              <Switch
                checked={editForm.status === "published"}
                onCheckedChange={(checked) =>
                  setEditForm({ ...editForm, status: checked ? "published" : "draft" })
                }
              />
              <div>
                <p className="font-medium">Published</p>
                <p className="text-sm text-muted-foreground">
                  {editForm.status === "published" 
                    ? "Visible to all users" 
                    : "Only visible to admins"}
                </p>
              </div>
            </div>
            <Button
              onClick={saveChallenge}
              disabled={isSubmitting}
              className="bg-cyan-500 hover:bg-cyan-400 text-black"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Details
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modules & Lessons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Modules & Lessons</span>
            <Button onClick={addModule} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Module
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {challenge.challenge_modules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No modules yet. Add your first module to get started.</p>
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-4">
              {challenge.challenge_modules.map((mod, modIndex) => (
                <AccordionItem key={mod.id} value={mod.id} className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        Module {modIndex + 1}: {mod.title}
                      </span>
                      <Badge variant="outline" className="ml-2">
                        {mod.challenge_lessons.length} lessons
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <Input
                        value={mod.title}
                        className="max-w-md"
                        placeholder="Module title"
                        onChange={async (e) => {
                          try {
                            await fetch(`/api/admin/modules/${mod.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ title: e.target.value }),
                            });
                          } catch (err) {}
                        }}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addLesson(mod.id, mod.challenge_lessons.length)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Lesson
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteModule(mod.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Lessons */}
                    <div className="space-y-3 ml-4">
                      {mod.challenge_lessons.map((lesson, lessonIndex) => (
                        <Card key={lesson.id} className="bg-muted/50">
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">
                                  Lesson {lessonIndex + 1}
                                </span>
                                <Input
                                  value={lesson.title}
                                  className="max-w-sm"
                                  placeholder="Lesson title"
                                  onChange={async (e) => {
                                    try {
                                      await fetch(`/api/admin/lessons/${lesson.id}`, {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ title: e.target.value }),
                                      });
                                    } catch (err) {}
                                  }}
                                />
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteLesson(lesson.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>

                            {/* Content Blocks */}
                            <div className="space-y-2">
                              {lesson.lesson_content_blocks.map((block) => (
                                <div
                                  key={block.id}
                                  className="flex items-center gap-2 p-2 bg-background rounded"
                                >
                                  {getBlockIcon(block.block_type)}
                                  <span className="text-sm capitalize">
                                    {block.block_type.replace("_", " ")}
                                  </span>
                                  <span className="text-xs text-muted-foreground truncate flex-1">
                                    {block.content?.substring(0, 50) || block.file_name || "..."}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => deleteContentBlock(block.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>

                            {/* Add Content Block */}
                            <div className="flex gap-2 mt-3">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addContentBlock(lesson.id, "rich_text", lesson.lesson_content_blocks.length)}
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                Text
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addContentBlock(lesson.id, "image", lesson.lesson_content_blocks.length)}
                              >
                                <ImageIcon className="h-3 w-3 mr-1" />
                                Image
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addContentBlock(lesson.id, "video", lesson.lesson_content_blocks.length)}
                              >
                                <Video className="h-3 w-3 mr-1" />
                                Video
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addContentBlock(lesson.id, "file", lesson.lesson_content_blocks.length)}
                              >
                                <File className="h-3 w-3 mr-1" />
                                File
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
