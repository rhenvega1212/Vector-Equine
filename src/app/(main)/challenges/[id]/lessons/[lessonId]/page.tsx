import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LessonContent } from "@/components/challenges/lesson-content";
import { LessonAssignment } from "@/components/challenges/lesson-assignment";
import { LessonNavigation } from "@/components/challenges/lesson-navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCircle } from "lucide-react";

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

  // Check enrollment
  const { data: enrollment } = await supabase
    .from("challenge_enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("challenge_id", challengeId)
    .single();

  if (!enrollment) {
    redirect(`/challenges/${challengeId}`);
  }

  // Get lesson with content blocks and assignment
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

  // Get all lessons in the challenge for navigation
  const { data: allModules } = await supabase
    .from("challenge_modules")
    .select(`
      id,
      title,
      sort_order,
      challenge_lessons (id, title, sort_order)
    `)
    .eq("challenge_id", challengeId)
    .order("sort_order") as { data: any[] | null };

  // Sort and flatten all lessons
  const sortedModules = (allModules || []).sort(
    (a, b) => a.sort_order - b.sort_order
  );
  const allLessons: any[] = [];
  sortedModules.forEach((module: any) => {
    module.challenge_lessons.sort(
      (a: any, b: any) => a.sort_order - b.sort_order
    );
    module.challenge_lessons.forEach((lesson: any) => {
      allLessons.push({ ...lesson, moduleTitle: module.title });
    });
  });

  const currentIndex = allLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson =
    currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  // Get completed lessons
  const lessonIds = allLessons.map((l) => l.id);
  const { data: completions } = await supabase
    .from("lesson_completions")
    .select("lesson_id")
    .eq("user_id", user.id)
    .in("lesson_id", lessonIds) as { data: any[] | null };
  const completedLessonIds = completions?.map((c: any) => c.lesson_id) || [];

  const isCompleted = completedLessonIds.includes(lessonId);
  const progressPercent = Math.round(
    (completedLessonIds.length / allLessons.length) * 100
  );

  // Get user's submission if assignment exists
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

  // Sort content blocks
  const contentBlocks = [...(lesson.lesson_content_blocks || [])].sort(
    (a, b) => a.sort_order - b.sort_order
  );

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
            <span>
              {completedLessonIds.length}/{allLessons.length}
            </span>
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
        </CardContent>
      </Card>

      <div className="space-y-6">
        {contentBlocks.map((block) => (
          <LessonContent key={block.id} block={block} />
        ))}

        {lesson.assignments && lesson.assignments.length > 0 && (
          <LessonAssignment
            assignment={lesson.assignments[0]}
            lessonId={lessonId}
            challengeId={challengeId}
            userSubmission={userSubmission}
            isCompleted={isCompleted}
          />
        )}

        <LessonNavigation
          challengeId={challengeId}
          lessonId={lessonId}
          prevLesson={prevLesson}
          nextLesson={nextLesson}
          isCompleted={isCompleted}
          hasSubmission={
            lesson.requires_submission && lesson.assignments?.length > 0
          }
          hasUserSubmission={!!userSubmission}
        />
      </div>
    </div>
  );
}
