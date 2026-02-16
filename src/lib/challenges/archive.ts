import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ArchiveItem = {
  assignment: { id: string; title: string };
  submissions: {
    id: string;
    content: string | null;
    media_url: string | null;
    created_at: string;
    author_display_name: string;
    comments: {
      id: string;
      content: string;
      created_at: string;
      author_display_name: string;
    }[];
  }[];
};

export type ArchiveData = {
  challenge: { id: string; title: string };
  items: ArchiveItem[];
};

export async function getArchiveData(challengeId: string): Promise<ArchiveData | null> {
  const supabase = await createClient();
  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, title, status")
    .eq("id", challengeId)
    .single();

  if (!challenge || challenge.status !== "archived") {
    return null;
  }

  const admin = createAdminClient();
  const { data: fullChallenge } = await admin
    .from("challenges")
    .select(`
      id,
      title,
      challenge_modules (
        id,
        challenge_lessons (
          id,
          assignments (
            id,
            title
          )
        )
      )
    `)
    .eq("id", challengeId)
    .single() as { data: any };

  if (!fullChallenge) return null;

  const assignments: { id: string; title: string }[] = [];
  for (const mod of fullChallenge.challenge_modules || []) {
    for (const lesson of mod.challenge_lessons || []) {
      for (const a of lesson.assignments || []) {
        assignments.push({ id: a.id, title: a.title });
      }
    }
  }

  const assignmentIds = assignments.map((a) => a.id);
  if (assignmentIds.length === 0) {
    return { challenge: { id: challenge.id, title: challenge.title }, items: [] };
  }

  const { data: submissions } = await admin
    .from("submissions")
    .select(`
      id,
      assignment_id,
      content,
      media_url,
      created_at,
      profiles!submissions_user_id_fkey (display_name)
    `)
    .in("assignment_id", assignmentIds)
    .order("created_at", { ascending: false }) as { data: any[] };

  const commentsBySubmission: Record<string, any[]> = {};
  if (submissions?.length) {
    const { data: comments } = await admin
      .from("submission_comments")
      .select(`
        id,
        submission_id,
        content,
        created_at,
        profiles!submission_comments_author_id_fkey (display_name)
      `)
      .in("submission_id", submissions.map((s: any) => s.id)) as { data: any[] };
    for (const c of comments || []) {
      if (!commentsBySubmission[c.submission_id]) commentsBySubmission[c.submission_id] = [];
      commentsBySubmission[c.submission_id].push(c);
    }
  }

  const items: ArchiveItem[] = assignments.map((assignment) => ({
    assignment: { id: assignment.id, title: assignment.title },
    submissions: (submissions || [])
      .filter((s: any) => s.assignment_id === assignment.id)
      .map((s: any) => ({
        id: s.id,
        content: s.content,
        media_url: s.media_url,
        created_at: s.created_at,
        author_display_name: (s.profiles?.display_name as string) ?? "Participant",
        comments: (commentsBySubmission[s.id] || []).map((c: any) => ({
          id: c.id,
          content: c.content,
          created_at: c.created_at,
          author_display_name: (c.profiles?.display_name as string) ?? "Participant",
        })),
      })),
  }));

  return { challenge: { id: challenge.id, title: challenge.title }, items };
}
