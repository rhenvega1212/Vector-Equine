import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChallengeEditor } from "@/components/admin/challenge-editor";

interface EditChallengePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditChallengePage({ params }: EditChallengePageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single() as { data: any };

  if (profile?.role !== "admin") {
    redirect("/challenges");
  }

  // Get challenge with all related data
  const { data: challenge } = await supabase
    .from("challenges")
    .select(`
      *,
      challenge_modules (
        *,
        challenge_lessons (
          *,
          lesson_content_blocks (*),
          assignments (*)
        )
      )
    `)
    .eq("id", id)
    .single() as { data: any };

  if (!challenge) {
    notFound();
  }

  // Sort modules and lessons by sort_order
  if (challenge.challenge_modules) {
    challenge.challenge_modules.sort((a: any, b: any) => a.sort_order - b.sort_order);
    challenge.challenge_modules.forEach((mod: any) => {
      if (mod.challenge_lessons) {
        mod.challenge_lessons.sort((a: any, b: any) => a.sort_order - b.sort_order);
        mod.challenge_lessons.forEach((lesson: any) => {
          if (lesson.lesson_content_blocks) {
            lesson.lesson_content_blocks.sort((a: any, b: any) => a.sort_order - b.sort_order);
          }
        });
      }
    });
  }

  return <ChallengeEditor challenge={challenge} />;
}
