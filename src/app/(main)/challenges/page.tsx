import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Clock, Users, Plus, PenTool } from "lucide-react";

const NICHE_OPTIONS = [
  { value: "dressage", label: "Dressage" },
  { value: "rider", label: "Rider" },
  { value: "reining", label: "Reining" },
  { value: "young_horse", label: "Young Horse" },
] as const;

const VALID_NICHES = new Set(NICHE_OPTIONS.map((o) => o.value));

function nicheLabel(niche: string | null | undefined): string {
  if (!niche) return "";
  const opt = NICHE_OPTIONS.find((o) => o.value === niche);
  return opt?.label ?? niche;
}

interface ChallengesPageProps {
  searchParams: Promise<{ niche?: string }> | { niche?: string };
}

export default async function ChallengesPage({ searchParams }: ChallengesPageProps) {
  const resolvedParams = await Promise.resolve(searchParams);
  const nicheFilter =
    resolvedParams.niche && VALID_NICHES.has(resolvedParams.niche as any)
      ? resolvedParams.niche
      : null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Check if user is admin
  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single() as { data: any };
    isAdmin = profile?.role === "admin";
  }

  // Get user's enrollments
  let enrolledChallengeIds: string[] = [];
  if (user) {
    const { data: enrollments } = await supabase
      .from("challenge_enrollments")
      .select("challenge_id")
      .eq("user_id", user.id) as { data: any[] | null };
    enrolledChallengeIds = enrollments?.map((e: any) => e.challenge_id) || [];
  }

  // Main platform page ALWAYS shows only published challenges
  let query = supabase
    .from("challenges")
    .select(`
      *,
      profiles!challenges_creator_id_fkey (id, display_name),
      challenge_enrollments (id)
    `)
    .in("status", ["published", "active"])
    .eq("is_private", false);

  if (nicheFilter) {
    query = query.eq("niche", nicheFilter);
  }

  const { data: challenges } = await query.order("created_at", { ascending: false }) as { data: any[] | null };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Challenges</h1>
          <p className="text-muted-foreground">
            Structured courses to improve your skills
          </p>
        </div>
        <div className="flex gap-2">
          {enrolledChallengeIds.length > 0 && (
            <Link href="/challenges/my">
              <Button variant="outline">My Challenges</Button>
            </Link>
          )}
          {isAdmin && (
            <>
              <Link href="/admin/challenges">
                <Button variant="outline">
                  Manage Challenges
                </Button>
              </Link>
              <Link href="/admin/challenges/create">
                <Button className="bg-cyan-500 hover:bg-cyan-400 text-black">
                  <PenTool className="h-4 w-4 mr-2" />
                  Build Challenge
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          href="/challenges"
          className={!nicheFilter ? "pointer-events-none" : undefined}
        >
          <Button variant={!nicheFilter ? "default" : "outline"} size="sm">
            All
          </Button>
        </Link>
        {NICHE_OPTIONS.map((opt) => (
          <Link
            key={opt.value}
            href={`/challenges?niche=${opt.value}`}
            className={nicheFilter === opt.value ? "pointer-events-none" : undefined}
          >
            <Button
              variant={nicheFilter === opt.value ? "default" : "outline"}
              size="sm"
            >
              {opt.label}
            </Button>
          </Link>
        ))}
      </div>

      {!challenges || challenges.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {isAdmin ? (
              <div className="space-y-4">
                <p>No published challenges yet.</p>
                <p className="text-sm">Create and publish challenges from the admin panel.</p>
                <div className="flex gap-2 justify-center">
                  <Link href="/admin/challenges">
                    <Button variant="outline">
                      Manage Challenges
                    </Button>
                  </Link>
                  <Link href="/admin/challenges/create">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Challenge
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              "No challenges available yet. Check back soon!"
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {challenges.map((challenge) => {
            const isEnrolled = enrolledChallengeIds.includes(challenge.id);
            const enrollmentCount = challenge.challenge_enrollments?.length || 0;

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
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex flex-wrap gap-1">
                        {challenge.niche && (
                          <Badge variant="secondary" className="text-xs">
                            {nicheLabel(challenge.niche)}
                          </Badge>
                        )}
                        {challenge.difficulty && (
                          <Badge variant="outline" className="text-xs">
                            {challenge.difficulty}
                          </Badge>
                        )}
                      </div>
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
