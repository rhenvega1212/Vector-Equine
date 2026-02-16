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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createChallengeSchema, type CreateChallengeInput } from "@/lib/validations/challenge";
import { uploadFile, isValidImageType } from "@/lib/uploads/storage";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Upload, X, Calendar, Infinity } from "lucide-react";

export default function CreateChallengePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateChallengeInput>({
    resolver: zodResolver(createChallengeSchema),
    defaultValues: {
      status: "draft",
      is_private: false,
      schedule_type: "scheduled",
    },
  });

  const scheduleType = watch("schedule_type") ?? "scheduled";
  const isEvergreen = scheduleType === "evergreen";

  async function handleCoverUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isValidImageType(file)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPG, PNG, GIF, or WebP image.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { url } = await uploadFile(
        "challenge-media",
        file,
        `covers/${Date.now()}-${file.name}`
      );
      setCoverUrl(url);
      setValue("cover_image_url", url);
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload cover image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }

  async function onSubmit(data: CreateChallengeInput) {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const challenge = await response.json();
        toast({
          title: "Challenge created",
          description: "You can now add modules and lessons.",
        });
        router.push(`/admin/challenges/${challenge.id}/edit`);
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to create challenge");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create challenge.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <Link href="/admin/challenges">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Challenges
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Create Challenge</CardTitle>
          <CardDescription>
            Create a new challenge for users to participate in
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label>Cover Image</Label>
              {coverUrl ? (
                <div className="relative">
                  <img
                    src={coverUrl}
                    alt=""
                    className="w-full h-40 object-cover rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setCoverUrl(null);
                      setValue("cover_image_url", undefined);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div>
                  <Label htmlFor="cover" className="cursor-pointer">
                    <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/50 transition-colors">
                      {isUploading ? (
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                      ) : (
                        <>
                          <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                          <p className="mt-2 text-sm text-muted-foreground">
                            Click to upload cover image
                          </p>
                        </>
                      )}
                    </div>
                  </Label>
                  <Input
                    id="cover"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCoverUpload}
                    disabled={isUploading}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" {...register("title")} />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register("description")}
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="niche">Niche</Label>
              <Select
                onValueChange={(value) => setValue("niche", value === "" ? undefined : (value as any))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select niche (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dressage">Dressage</SelectItem>
                  <SelectItem value="rider">Rider</SelectItem>
                  <SelectItem value="reining">Reining</SelectItem>
                  <SelectItem value="young_horse">Young Horse</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Who this course is meant for (used to filter and sort challenges).
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="difficulty">Difficulty</Label>
                <Select onValueChange={(value) => setValue("difficulty", value as any)}>
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
                  {...register("duration_days", { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="price_display">Price (display only)</Label>
              <Input
                id="price_display"
                placeholder="e.g., $49 or Free"
                {...register("price_display")}
              />
            </div>

            {/* Schedule */}
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Schedule</span>
              </div>
              <div className="flex gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    value="scheduled"
                    {...register("schedule_type")}
                    onChange={(e) => {
                      setValue("schedule_type", "scheduled");
                    }}
                    className="h-4 w-4"
                  />
                  <span>Scheduled (fixed dates)</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    value="evergreen"
                    {...register("schedule_type")}
                    onChange={(e) => {
                      setValue("schedule_type", "evergreen");
                      setValue("end_at", null);
                      setValue("start_at", null);
                      setValue("open_at", null);
                      setValue("close_at", null);
                    }}
                    className="h-4 w-4"
                  />
                  <Infinity className="h-4 w-4 text-muted-foreground" />
                  <span>Evergreen (self paced, no end date)</span>
                </label>
              </div>
              {!isEvergreen && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="open_at">Enrollment open date/time (optional)</Label>
                    <Input
                      id="open_at"
                      type="datetime-local"
                      {...register("open_at")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="close_at">Enrollment close date/time (optional)</Label>
                    <Input
                      id="close_at"
                      type="datetime-local"
                      {...register("close_at")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="start_at">Challenge start date/time</Label>
                    <Input
                      id="start_at"
                      type="datetime-local"
                      {...register("start_at")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_at">Challenge end date/time *</Label>
                    <Input
                      id="end_at"
                      type="datetime-local"
                      {...register("end_at")}
                    />
                    <p className="text-xs text-muted-foreground">
                      When this passes, the challenge is automatically archived (no new enrollments or submissions).
                    </p>
                    {errors.end_at && (
                      <p className="text-sm text-destructive">{errors.end_at.message}</p>
                    )}
                  </div>
                </div>
              )}
              {isEvergreen && (
                <p className="text-sm text-muted-foreground">
                  Evergreen challenges have no end date. Users can enroll anytime (unless you manually close enrollment).
                  No automatic archiving.
                </p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_private"
                onCheckedChange={(checked) =>
                  setValue("is_private", checked === true)
                }
              />
              <Label htmlFor="is_private" className="cursor-pointer">
                Private challenge (only visible to enrolled users)
              </Label>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Create Challenge
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
