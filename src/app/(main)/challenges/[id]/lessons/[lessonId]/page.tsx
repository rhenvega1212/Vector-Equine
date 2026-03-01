import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BlockRendererClient } from "@/components/challenges/block-renderer-client";
import { LessonNavigation } from "@/components/challenges/lesson-navigation";
import { GatingStatus } from "@/components/challenges/gating-status";
import { ProgressIndicator } from "@/components/challenges/progress-indicator";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCircle, Clock } from "lucide-react";
import { evaluateGating, calculateLessonProgress, type LessonProgressData, type LessonGatingConfig } from "@/lib/challenges/gating";

interface LessonPageProps {
  params: Promise<{ id: string; lessonId: string }>;
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { id: challengeId, lessonId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: enrollment } = await supabase
    .from("challenge_enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("challenge_id", challengeId)
    .single();

  if (!enrollment) {
    redirect(`/challenges/${challengeId}`);
  }

  const { data: lesson } = await supabase
    .from("challenge_lessons")
    .select(`
      *,
      challenge_modules!inner (
        id,
        title,
        challenge_id,
        challenges!inner (id, title)
      ),
      lesson_content_blocks (*),
      assignments (*)
    `)
    .eq("id", lessonId)
    .single() as { data: any };

  if (!lesson || lesson.challenge_modules.challenge_id !== challengeId) {
    notFound();
  }

  const { data: allModules } = await supabase
    .from("challenge_modules")
    .select(`
      id, title, sort_order,
      challenge_lessons (id, title, sort_order)
    `)
    .eq("challenge_id", challengeId)
    .order("sort_order") as { data: any[] | null };

  const sortedModules = (allModules || []).sort((a, b) => a.sort_order - b.sort_order);
  const allLessons: any[] = [];
  sortedModules.forEach((module: any) => {
    module.challenge_lessons.sort((a: any, b: any) => a.sort_order - b.sort_order);
    module.challenge_lessons.forEach((l: any) => {
      allLessons.push({ ...l, moduleTitle: module.title });
    });
  });

  const currentIndex = allLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  const lessonIds = allLessons.map((l) => l.id);
  const { data: completions } = await supabase
    .from("lesson_completions")
    .select("lesson_id")
    .eq("user_id", user.id)
    .in("lesson_id", lessonIds) as { data: any[] | null };
  const completedLessonIds = completions?.map((c: any) => c.lesson_id) || [];
  const isCompleted = completedLessonIds.includes(lessonId);
  const progressPercent = Math.round((completedLessonIds.length / allLessons.length) * 100);

  // Get block completions
  const contentBlocks = [...(lesson.lesson_content_blocks || [])].sort(
    (a: any, b: any) => a.sort_order - b.sort_order
  );
  const blockIds = contentBlocks.map((b: any) => b.id);
  const { data: blockCompletions } = await supabase
    .from("block_completions")
    .select("block_id")
    .eq("user_id", user.id)
    .in("block_id", blockIds.length > 0 ? blockIds : ["none"]) as { data: any[] | null };
  const completedBlockIds = blockCompletions?.map((c: any) => c.block_id) || [];

  // Evaluate gating for next lesson
  const gatingConfig: LessonGatingConfig = {
    gatingType: (lesson.gating_type as any) || "none",
    gatingRules: (lesson.gating_rules as any) || {},
  };

  // Build progress data for gating
  const blockProgress = contentBlocks.map((b: any) => ({
    blockId: b.id,
    blockType: b.block_type,
    isRequired: b.is_required || false,
    isCompleted: completedBlockIds.includes(b.id),
  }));

  const lessonProgress = calculateLessonProgress(blockProgress);
  const lessonProgressData: LessonProgressData = {
    lessonId,
    blocks: blockProgress,
    discussionPostCount: 0,
    submissionStatus: null,
    manuallyApproved: false,
  };
  const gatingResult = evaluateGating(gatingConfig, lessonProgressData);

  // Check for submission
  let userSubmission = null;
  if (lesson.assignments && lesson.assignments.length > 0) {
    const { data: submission } = await supabase
      .from("submissions")
      .select("*")
      .eq("assignment_id", lesson.assignments[0].id)
      .eq("user_id", user.id)
      .single();
    userSubmission = submission;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Link href={`/challenges/${challengeId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Challenge
          </Button>
        </Link>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
            <span>{completedLessonIds.length}/{allLessons.length}</span>
            <Progress value={progressPercent} className="w-24 h-2" />
          </div>
          {isCompleted && (
            <Badge variant="outline" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              Completed
            </Badge>
          )}
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            {lesson.challenge_modules.title}
          </p>
          <h1 className="text-2xl font-bold mt-1">{lesson.title}</h1>
          {lesson.description && (
            <p className="text-muted-foreground mt-2">{lesson.description}</p>
          )}
          <div className="flex items-center gap-4 mt-3">
            {lesson.estimated_time && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {lesson.estimated_time} min
              </span>
            )}
            {lessonProgress.requiredTotal > 0 && (
              <span className="text-sm text-muted-foreground">
                {lessonProgress.requiredComplete}/{lessonProgress.requiredTotal} blocks completed
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <BlockRendererClient
        blocks={contentBlocks}
        currentUserId={user.id}
        challengeId={challengeId}
        completedBlockIds={completedBlockIds}
      />

      {gatingConfig.gatingType !== "none" && (
        <div className="mt-6">
          <GatingStatus gatingResult={gatingResult} gatingType={gatingConfig.gatingType} />
        </div>
      )}

      <div className="mt-6">
        <LessonNavigation
          challengeId={challengeId}
          lessonId={lessonId}
          prevLesson={prevLesson}
          nextLesson={nextLesson}
          isCompleted={isCompleted}
          hasSubmission={lesson.requires_submission && lesson.assignments?.length > 0}
          hasUserSubmission={!!userSubmission}
        />
      </div>
    </div>
  );
}
