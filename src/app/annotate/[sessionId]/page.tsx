import { AnnotationWorkspace } from "@/components/annotation/annotation-workspace";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Annotate · Vector Equine",
};

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function AnnotateSessionPage({ params }: PageProps) {
  const { sessionId } = await params;

  // Internal tool: use the signed-in user as author when available, otherwise
  // fall back to a demo id so the tool remains usable without auth.
  let authorId = "rider-demo";
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) authorId = user.id;
  } catch {
    // no-op — keep demo author
  }

  return <AnnotationWorkspace specId={sessionId} authorId={authorId} />;
}
