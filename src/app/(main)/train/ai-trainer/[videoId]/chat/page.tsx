import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { AiTrainerChat } from "@/components/train/ai-trainer-chat";

export default async function AiTrainerChatPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: video } = await supabase
    .from("ai_video_uploads")
    .select("id, horse")
    .eq("id", videoId)
    .eq("user_id", user.id)
    .single();

  if (!video) notFound();

  const { data: analysis } = await supabase
    .from("ai_analyses")
    .select("id")
    .eq("video_id", videoId)
    .single();

  if (!analysis) notFound();

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/train/ai-trainer/${videoId}`} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to analysis
        </Link>
      </Button>
      <div>
        <h1 className="text-2xl font-bold">Chat about this ride</h1>
        <p className="text-muted-foreground">{video.horse ? `Horse: ${video.horse}` : "Discuss your analysis"}</p>
      </div>
      <AiTrainerChat analysisId={analysis.id} />
    </div>
  );
}
