import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CourseEditor } from "@/components/admin/course-editor";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single() as { data: any };

  if (profile?.role !== "admin") {
    redirect("/challenges");
  }

  return (
    <div className="h-[calc(100vh-4rem)]">
      <CourseEditor challengeId={id} />
    </div>
  );
}
