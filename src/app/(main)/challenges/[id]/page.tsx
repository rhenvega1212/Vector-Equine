import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChallengeEnroll } from "@/components/challenges/challenge-enroll";
import { ProgressIndicator } from "@/components/challenges/progress-indicator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Trophy,
  Clock,
  Users,
  CheckCircle,
  Lock,
  PlayCircle,
} from "lucide-react";
import { calculateModuleProgress } from "@/lib/challenges/gating";

interface ChallengePageProps {
  params: Promise<{ id: string }>;
}

export default async function ChallengePage({ params }: ChallengePageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single() as { data: any };
    isAdmin = profile?.role === "admin";
  }

  const { data: challenge } = await supabase
    .from("challenges")
    .select(`
      *,
      profiles!challenges_creator_id_fkey (id, display_name),
      challenge_modules (
        id,
        title,
        description,
        sort_order,
        challenge_lessons (
          id,
          title,
          description,
          requires_submission,
          sort_order,
          gating_type,
          estimated_time
        )
      ),
      challenge_enrollments (id, user_id)
    `)
    .eq("id", id)
    .single() as { data: any };

  if (!challenge) {
    notFound();
  }

  const isDraft = challenge.status === "draft";
  if (isDraft && !isAdmin) {
    notFound();
  }

  const isArchived = challenge.status === "archived";
  if (isArchived) {
    return (
      <div className="max-w-4xl mx-auto">
        <Link href="/challenges">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Challenges
          </Button>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>{challenge.title}</CardTitle>
            <CardDescription>
              This challenge has ended and is archived. No new enrollments or submissions are allowed.
              You can browse participant submissions in the archive.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/challenges/${challenge.id}/archive`}>
              <Button>View archive (participant submissions)</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isEnrolled = user
    ? challenge.challenge_enrollments.some((e: any) => e.user_id === user.id)
    : false;

  let completedLessonIds: string[] = [];
  if (user && isEnrolled) {
    const allLessonIds = challenge.challenge_modules.flatMap((m: any) =>
      m.challenge_lessons.map((l: any) => l.id)
    );
    const { data: completions } = await supabase
      .from("lesson_completions")
      .select("lesson_id")
      .eq("user_id", user.id)
      .in("lesson_id", allLessonIds) as { data: any[] | null };
    completedLessonIds = completions?.map((c: any) => c.lesson_id) || [];
  }

  const sortedModules = [...challenge.challenge_modules].sort(
    (a: any, b: any) => a.sort_order - b.sort_order
  );
  sortedModules.forEach((module: any) => {
    module.challenge_lessons.sort(
      (a: any, b: any) => a.sort_order - b.sort_order
    );
  });

  const totalLessons = sortedModules.reduce(
    (acc: number, m: any) => acc + m.challenge_lessons.length,
    0
  );
  const completedCount = completedLessonIds.length;
  const progressPercent =
    totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  let currentLessonId: string | null = null;
  outer: for (const mod of sortedModules) {
    for (const lesson of mod.challenge_lessons) {
      if (!completedLessonIds.includes(lesson.id)) {
        currentLessonId = lesson.id;
        break outer;
      }
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/challenges">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Challenges
        </Button>
      </Link>

      {isDraft && isAdmin && (
        <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className="bg-yellow-500 text-black">Draft</Badge>
            <span className="text-sm text-yellow-200">This challenge is not yet published. Only admins can see it.</span>
          </div>
          <Link href={`/admin/challenges/${challenge.id}/edit`}>
            <Button size="sm" variant="outline" className="border-yellow-500/50 text-yellow-200 hover:bg-yellow-500/20">
              Edit & Publish
            </Button>
          </Link>
        </div>
      )}

      {challenge.cover_image_url && (
        <img
          src={challenge.cover_image_url}
          alt=""
          className="w-full h-64 md:h-80 object-cover rounded-lg mb-6"
        />
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              {challenge.difficulty && (
                <Badge variant="outline">{challenge.difficulty}</Badge>
              )}
              {challenge.duration_days && (
                <Badge variant="outline">
                  <Clock className="h-3 w-3 mr-1" />
                  {challenge.duration_days} days
                </Badge>
              )}
            </div>
            <h1 className="text-3xl font-bold">{challenge.title}</h1>
            {challenge.description && (
              <p className="text-muted-foreground mt-2">
                {challenge.description}
              </p>
            )}
          </div>

          <Separator />

          <div>
            <h2 className="text-xl font-semibold mb-4">Course Content</h2>
            <div className="space-y-4">
              {sortedModules.map((module: any, moduleIndex: number) => {
                const moduleLessons = module.challenge_lessons.map((l: any) => ({
                  isComplete: completedLessonIds.includes(l.id),
                }));
                const modProgress = calculateModuleProgress(moduleLessons);

                return (
                  <Card key={module.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                          Module {moduleIndex + 1}: {module.title}
                        </CardTitle>
                      </div>
                      {module.description && (
                        <p className="text-sm text-muted-foreground">
                          {module.description}
                        </p>
                      )}
                      {isEnrolled && module.challenge_lessons.length > 0 && (
                        <div className="pt-2">
                          <ProgressIndicator variant="module" progress={modProgress} />
                        </div>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {module.challenge_lessons.map(
                          (lesson: any, lessonIndex: number) => {
                            const isLessonCompleted = completedLessonIds.includes(lesson.id);
                            const isCurrent = lesson.id === currentLessonId;

                            const prevLessonInModule = lessonIndex > 0
                              ? module.challenge_lessons[lessonIndex - 1]
                              : null;
                            const prevLessonComplete = prevLessonInModule
                              ? completedLessonIds.includes(prevLessonInModule.id)
                              : true;
                            const lessonGating = lesson.gating_type || "none";
                            const isLocked =
                              isEnrolled &&
                              !isLessonCompleted &&
                              !isCurrent &&
                              lessonGating === "hard" &&
                              !prevLessonComplete;

                            return (
                              <div
                                key={lesson.id}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                              >
                                {isLessonCompleted ? (
                                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                                ) : isLocked ? (
                                  <Lock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                ) : (
                                  <PlayCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {isEnrolled && !isLocked ? (
                                      <Link
                                        href={`/challenges/${challenge.id}/lessons/${lesson.id}`}
                                        className="font-medium hover:underline"
                                      >
                                        {lesson.title}
                                      </Link>
                                    ) : (
                                      <span
                                        className={isLocked ? "text-muted-foreground" : ""}
                                      >
                                        {lesson.title}
                                      </span>
                                    )}
                                    {lesson.requires_submission && (
                                      <Badge variant="secondary" className="text-xs">
                                        Assignment
                                      </Badge>
                                    )}
                                    {lesson.estimated_time != null && lesson.estimated_time > 0 && (
                                      <Badge variant="outline" className="text-xs gap-1 py-0">
                                        <Clock className="h-3 w-3" />
                                        {lesson.estimated_time} min
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              {isEnrolled ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Progress</span>
                      <span>
                        {completedCount}/{totalLessons} lessons
                      </span>
                    </div>
                    <Progress value={progressPercent} />
                    <p className="text-sm text-muted-foreground mt-2">
                      {progressPercent}% complete
                    </p>
                  </div>
                  {currentLessonId && (
                    <Link
                      href={`/challenges/${challenge.id}/lessons/${currentLessonId}`}
                    >
                      <Button className="w-full">
                        <PlayCircle className="h-4 w-4 mr-2" />
                        Continue Learning
                      </Button>
                    </Link>
                  )}
                  {progressPercent === 100 && (
                    <div className="text-center p-4 bg-primary/10 rounded-lg">
                      <Trophy className="h-8 w-8 text-primary mx-auto mb-2" />
                      <p className="font-semibold">Challenge Complete!</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {challenge.price_display && (
                    <p className="text-2xl font-bold text-center">
                      {challenge.price_display}
                    </p>
                  )}
                  <ChallengeEnroll challengeId={challenge.id} />
                  <p className="text-xs text-muted-foreground text-center">
                    {challenge.challenge_enrollments.length} already enrolled
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3">What you&apos;ll learn</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>
                    {sortedModules.length} modules with {totalLessons} lessons
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Structured progression with gated content</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Hands-on assignments with feedback</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Community submissions feed</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
