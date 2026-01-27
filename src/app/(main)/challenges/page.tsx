import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Clock, Users } from "lucide-react";

export default async function ChallengesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get user's enrollments
  let enrolledChallengeIds: string[] = [];
  if (user) {
    const { data: enrollments } = await supabase
      .from("challenge_enrollments")
      .select("challenge_id")
      .eq("user_id", user.id) as { data: any[] | null };
    enrolledChallengeIds = enrollments?.map((e: any) => e.challenge_id) || [];
  }

  // Get published challenges
  const { data: challenges } = await supabase
    .from("challenges")
    .select(`
      *,
      profiles!challenges_creator_id_fkey (id, display_name),
      challenge_enrollments (id)
    `)
    .eq("status", "published")
    .eq("is_private", false)
    .order("created_at", { ascending: false }) as { data: any[] | null };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Challenges</h1>
          <p className="text-muted-foreground">
            Structured courses to improve your skills
          </p>
        </div>
        {enrolledChallengeIds.length > 0 && (
          <Link href="/challenges/my">
            <Button variant="outline">My Challenges</Button>
          </Link>
        )}
      </div>

      {!challenges || challenges.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No challenges available yet. Check back soon!
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {challenges.map((challenge) => {
            const isEnrolled = enrolledChallengeIds.includes(challenge.id);
            const enrollmentCount = challenge.challenge_enrollments.length;

            return (
              <Link key={challenge.id} href={`/challenges/${challenge.id}`}>
                <Card className="overflow-hidden hover:bg-muted/50 transition-colors h-full">
                  {challenge.cover_image_url ? (
                    <img
                      src={challenge.cover_image_url}
                      alt=""
                      className="w-full h-40 object-cover"
                    />
                  ) : (
                    <div className="w-full h-40 bg-muted flex items-center justify-center">
                      <Trophy className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      {challenge.difficulty && (
                        <Badge variant="outline" className="text-xs">
                          {challenge.difficulty}
                        </Badge>
                      )}
                      {isEnrolled && (
                        <Badge className="text-xs">Enrolled</Badge>
                      )}
                    </div>

                    <h3 className="font-semibold mt-2 line-clamp-2">
                      {challenge.title}
                    </h3>

                    {challenge.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {challenge.description}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                      {challenge.duration_days && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {challenge.duration_days} days
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {enrollmentCount} enrolled
                      </div>
                    </div>

                    {challenge.price_display && (
                      <p className="text-sm font-medium mt-3 text-primary">
                        {challenge.price_display}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
