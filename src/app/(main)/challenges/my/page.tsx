import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Trophy, Clock, CheckCircle } from "lucide-react";

export default async function MyChallengesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user's enrollments with challenge details
  const { data: enrollments } = await supabase
    .from("challenge_enrollments")
    .select(`
      *,
      challenges (
        id,
        title,
        description,
        cover_image_url,
        difficulty,
        duration_days,
        challenge_modules (
          challenge_lessons (id)
        )
      )
    `)
    .eq("user_id", user.id)
    .order("enrolled_at", { ascending: false }) as { data: any[] | null };

  // Get completed lessons for each enrollment
  const enrollmentsWithProgress = await Promise.all(
    (enrollments || []).map(async (enrollment: any) => {
      const allLessonIds = enrollment.challenges.challenge_modules.flatMap(
        (m: any) => m.challenge_lessons.map((l: any) => l.id)
      );

      const { data: completions } = await supabase
        .from("lesson_completions")
        .select("lesson_id")
        .eq("user_id", user.id)
        .in("lesson_id", allLessonIds) as { data: any[] | null };

      const completedCount = completions?.length || 0;
      const totalLessons = allLessonIds.length;
      const progressPercent =
        totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

      return {
        ...enrollment,
        completedCount,
        totalLessons,
        progressPercent,
      };
    })
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/challenges">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            All Challenges
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">My Challenges</h1>
          <p className="text-muted-foreground">
            Track your progress and continue learning
          </p>
        </div>
      </div>

      {enrollmentsWithProgress.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              You haven&apos;t joined any challenges yet.
            </p>
            <Link href="/challenges">
              <Button>Explore Challenges</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {enrollmentsWithProgress.map((enrollment) => (
            <Link
              key={enrollment.id}
              href={`/challenges/${enrollment.challenges.id}`}
            >
              <Card className="hover:bg-muted/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {enrollment.challenges.cover_image_url ? (
                      <img
                        src={enrollment.challenges.cover_image_url}
                        alt=""
                        className="w-24 h-24 md:w-32 md:h-32 object-cover rounded"
                      />
                    ) : (
                      <div className="w-24 h-24 md:w-32 md:h-32 bg-muted rounded flex items-center justify-center">
                        <Trophy className="h-10 w-10 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold">
                          {enrollment.challenges.title}
                        </h3>
                        {enrollment.completed_at ? (
                          <Badge className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Completed
                          </Badge>
                        ) : (
                          <Badge variant="secondary">In Progress</Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 mt-2">
                        {enrollment.challenges.difficulty && (
                          <Badge variant="outline" className="text-xs">
                            {enrollment.challenges.difficulty}
                          </Badge>
                        )}
                        {enrollment.challenges.duration_days && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Clock className="h-3 w-3" />
                            {enrollment.challenges.duration_days} days
                          </Badge>
                        )}
                      </div>

                      <div className="mt-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Progress</span>
                          <span>
                            {enrollment.completedCount}/{enrollment.totalLessons}
                          </span>
                        </div>
                        <Progress value={enrollment.progressPercent} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
