"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, ArrowRight, CheckCircle } from "lucide-react";

interface LessonNavigationProps {
  challengeId: string;
  lessonId: string;
  prevLesson: { id: string; title: string; moduleTitle: string } | null;
  nextLesson: { id: string; title: string; moduleTitle: string } | null;
  isCompleted: boolean;
  hasSubmission: boolean;
  hasUserSubmission: boolean;
}

export function LessonNavigation({
  challengeId,
  lessonId,
  prevLesson,
  nextLesson,
  isCompleted,
  hasSubmission,
  hasUserSubmission,
}: LessonNavigationProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isMarking, setIsMarking] = useState(false);

  async function handleMarkComplete() {
    if (hasSubmission && !hasUserSubmission) {
      toast({
        title: "Submission required",
        description: "Please complete the assignment before marking this lesson as done.",
        variant: "destructive",
      });
      return;
    }

    setIsMarking(true);
    try {
      const response = await fetch(
        `/api/challenges/lessons/${lessonId}/complete`,
        {
          method: "POST",
        }
      );

      if (response.ok) {
        toast({
          title: "Lesson completed!",
          description: nextLesson
            ? "Moving to the next lesson..."
            : "You've completed all lessons!",
        });
        router.refresh();
        if (nextLesson) {
          router.push(`/challenges/${challengeId}/lessons/${nextLesson.id}`);
        }
      } else {
        throw new Error("Failed to mark complete");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to mark lesson as complete. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsMarking(false);
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t">
      <div>
        {prevLesson ? (
          <Link
            href={`/challenges/${challengeId}/lessons/${prevLesson.id}`}
          >
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Previous:</span>{" "}
              <span className="truncate max-w-[150px]">{prevLesson.title}</span>
            </Button>
          </Link>
        ) : (
          <div />
        )}
      </div>

      <div className="flex gap-2">
        {!isCompleted && (
          <Button onClick={handleMarkComplete} disabled={isMarking}>
            {isMarking ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            {nextLesson ? "Complete & Continue" : "Complete Lesson"}
          </Button>
        )}

        {isCompleted && nextLesson && (
          <Link
            href={`/challenges/${challengeId}/lessons/${nextLesson.id}`}
          >
            <Button className="gap-2">
              Next: <span className="truncate max-w-[150px]">{nextLesson.title}</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
