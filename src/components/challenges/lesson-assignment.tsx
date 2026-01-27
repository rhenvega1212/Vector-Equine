"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { uploadFile, isValidImageType, isValidVideoType } from "@/lib/uploads/storage";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Upload, FileText, Image, Video, Link as LinkIcon, CheckCircle, Pin } from "lucide-react";

interface LessonAssignmentProps {
  assignment: {
    id: string;
    title: string;
    instructions: string | null;
    submission_type: "text" | "image" | "video" | "link";
  };
  lessonId: string;
  challengeId: string;
  userSubmission: {
    id: string;
    content: string | null;
    media_url: string | null;
    admin_feedback: string | null;
    is_feedback_pinned: boolean;
    created_at: string;
  } | null;
  isCompleted: boolean;
}

export function LessonAssignment({
  assignment,
  lessonId,
  challengeId,
  userSubmission,
  isCompleted,
}: LessonAssignmentProps) {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [content, setContent] = useState(userSubmission?.content || "");
  const [mediaUrl, setMediaUrl] = useState(userSubmission?.media_url || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (
      assignment.submission_type === "image" &&
      !isValidImageType(file)
    ) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file.",
        variant: "destructive",
      });
      return;
    }

    if (
      assignment.submission_type === "video" &&
      !isValidVideoType(file)
    ) {
      toast({
        title: "Invalid file type",
        description: "Please upload a video file.",
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
        "submissions",
        file,
        `${user.id}/${challengeId}/${lessonId}/${file.name}`
      );
      setMediaUrl(url);
      toast({
        title: "File uploaded",
        description: "Your file has been uploaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit() {
    if (assignment.submission_type === "text" && !content.trim()) {
      toast({
        title: "Content required",
        description: "Please enter your submission.",
        variant: "destructive",
      });
      return;
    }

    if (
      (assignment.submission_type === "image" ||
        assignment.submission_type === "video") &&
      !mediaUrl
    ) {
      toast({
        title: "File required",
        description: `Please upload ${
          assignment.submission_type === "image" ? "an image" : "a video"
        }.`,
        variant: "destructive",
      });
      return;
    }

    if (assignment.submission_type === "link" && !content.trim()) {
      toast({
        title: "Link required",
        description: "Please enter a link.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/challenges/lessons/${lessonId}/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignment_id: assignment.id,
            content: content.trim() || null,
            media_url: mediaUrl || null,
          }),
        }
      );

      if (response.ok) {
        toast({
          title: "Submission saved",
          description: "Your submission has been recorded.",
        });
        router.refresh();
      } else {
        throw new Error("Failed to submit");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const typeIcon = {
    text: FileText,
    image: Image,
    video: Video,
    link: LinkIcon,
  }[assignment.submission_type];
  const TypeIcon = typeIcon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TypeIcon className="h-5 w-5" />
            {assignment.title}
          </CardTitle>
          {userSubmission && (
            <Badge variant="outline" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              Submitted
            </Badge>
          )}
        </div>
        {assignment.instructions && (
          <p className="text-sm text-muted-foreground mt-2">
            {assignment.instructions}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {assignment.submission_type === "text" && (
          <div className="space-y-2">
            <Label>Your Response</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your response..."
              className="min-h-[150px]"
            />
          </div>
        )}

        {assignment.submission_type === "link" && (
          <div className="space-y-2">
            <Label>Link URL</Label>
            <Input
              type="url"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="https://..."
            />
          </div>
        )}

        {(assignment.submission_type === "image" ||
          assignment.submission_type === "video") && (
          <div className="space-y-2">
            <Label>
              Upload {assignment.submission_type === "image" ? "Image" : "Video"}
            </Label>
            {mediaUrl ? (
              <div className="relative">
                {assignment.submission_type === "image" ? (
                  <img
                    src={mediaUrl}
                    alt="Submission"
                    className="max-w-full rounded-lg"
                  />
                ) : (
                  <video
                    src={mediaUrl}
                    controls
                    className="max-w-full rounded-lg"
                  />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Replace File
                </Button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? (
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      Click to upload{" "}
                      {assignment.submission_type === "image"
                        ? "an image"
                        : "a video"}
                    </p>
                  </>
                )}
              </div>
            )}
            <Input
              ref={fileInputRef}
              type="file"
              accept={
                assignment.submission_type === "image"
                  ? "image/*"
                  : "video/*"
              }
              className="hidden"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
          </div>
        )}

        {/* Additional text response for media submissions */}
        {(assignment.submission_type === "image" ||
          assignment.submission_type === "video") && (
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add a description or reflection..."
              className="min-h-[80px]"
            />
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || isUploading}
        >
          {isSubmitting && (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          )}
          {userSubmission ? "Update Submission" : "Submit"}
        </Button>

        {/* Admin Feedback */}
        {userSubmission?.admin_feedback && (
          <Card className="mt-4 border-primary/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold text-sm">Instructor Feedback</span>
                {userSubmission.is_feedback_pinned && (
                  <Pin className="h-4 w-4 text-primary" />
                )}
              </div>
              <p className="text-sm">{userSubmission.admin_feedback}</p>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
