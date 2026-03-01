"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Eye, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CoverImageUpload } from "@/components/shared/cover-image-upload";

const challengeSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  duration_days: z.number().min(1).max(365).optional(),
  price_display: z.string().optional(),
  cover_image_url: z.string().url().optional().or(z.literal("")),
  status: z.enum(["draft", "published"]).default("draft"),
});

type ChallengeFormData = z.infer<typeof challengeSchema>;

interface ChallengeBuilderProps {
  initialData?: ChallengeFormData & { id?: string };
  isEditing?: boolean;
}

export function ChallengeBuilder({ initialData, isEditing = false }: ChallengeBuilderProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ChallengeFormData>({
    resolver: zodResolver(challengeSchema),
    defaultValues: initialData || {
      title: "",
      description: "",
      difficulty: undefined,
      duration_days: undefined,
      price_display: "",
      cover_image_url: "",
      status: "draft",
    },
  });

  const status = watch("status");

  async function onSubmit(data: ChallengeFormData) {
    setIsSubmitting(true);
    setError(null);

    try {
      const url = isEditing && initialData?.id 
        ? `/api/admin/challenges/${initialData.id}`
        : "/api/admin/challenges";
      
      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          cover_image_url: data.cover_image_url || null,
          duration_days: data.duration_days || null,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to save challenge");
      }

      const challenge = await response.json();
      
      if (isEditing) {
        router.refresh();
      } else {
        // Redirect to edit page to add modules and lessons
        router.push(`/admin/challenges/${challenge.id}/edit`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Challenge Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Groundwork Fundamentals"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-sm text-red-400">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe what participants will learn..."
              rows={4}
              {...register("description")}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select
                value={watch("difficulty") || ""}
                onValueChange={(value) => setValue("difficulty", value as any)}
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
              <Label htmlFor="duration_days">Duration (days)</Label>
              <Input
                id="duration_days"
                type="number"
                min={1}
                max={365}
                placeholder="e.g., 30"
                {...register("duration_days", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="price_display">Price Display</Label>
            <Input
              id="price_display"
              placeholder="e.g., $49.99 or Free"
              {...register("price_display")}
            />
            <p className="text-xs text-muted-foreground">
              Display only, no payments processed
            </p>
          </div>

          <div className="space-y-2">
            <Label>Cover Image</Label>
            <CoverImageUpload
              value={watch("cover_image_url") || null}
              onChange={(url) => setValue("cover_image_url", url || "")}
              pathPrefix={`covers/${initialData?.id || "new"}`}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publishing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Publish Challenge</p>
              <p className="text-sm text-muted-foreground">
                {status === "published" 
                  ? "This challenge is visible to all users"
                  : "Only admins can see this challenge"}
              </p>
            </div>
            <Switch
              checked={status === "published"}
              onCheckedChange={(checked) =>
                setValue("status", checked ? "published" : "draft")
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Link href="/challenges">
          <Button type="button" variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Challenges
          </Button>
        </Link>

        <div className="flex gap-2">
          {isEditing && initialData?.id && (
            <Link href={`/challenges/${initialData.id}`}>
              <Button type="button" variant="outline">
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
            </Link>
          )}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-cyan-500 hover:bg-cyan-400 text-black"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isEditing ? "Save Changes" : "Create Challenge"}
          </Button>
        </div>
      </div>
    </form>
  );
}
