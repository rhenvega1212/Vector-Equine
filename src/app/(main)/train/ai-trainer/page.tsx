import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { AiUploadForm } from "@/components/train/ai-upload-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, MessageSquare } from "lucide-react";
import { format } from "date-fns";

export default async function AiTrainerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: videos } = await supabase
    .from("ai_video_uploads")
    .select(`
      id,
      horse,
      notes,
      created_at,
      ai_analyses ( id, status )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const list = videos ?? [];
  const analysisByVideo = (v: (typeof list)[0]) => {
    const a = (v as { ai_analyses?: { id: string; status: string }[] | null }).ai_analyses;
    return Array.isArray(a) ? a[0] : a;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Trainer</h1>
        <p className="text-muted-foreground">
          Upload a training video for AI analysis, then chat about your ride.
        </p>
      </div>

      <AiUploadForm />

      {list.length > 0 && (
        <Card className="border-cyan-400/20">
          <CardHeader>
            <CardTitle>Recent uploads</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {list.map((v) => {
                const analysis = analysisByVideo(v);
                return (
                  <li key={v.id} className="flex items-center justify-between gap-4 rounded-lg border border-cyan-400/10 p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Video className="h-5 w-5 shrink-0 text-cyan-400/80" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{v.horse || "Untitled"}</p>
                        <p className="text-sm text-muted-foreground">{format(new Date(v.created_at), "MMM d, yyyy")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="outline" size="sm" asChild className="border-cyan-400/20">
                        <Link href={`/train/ai-trainer/${v.id}`}>Results</Link>
                      </Button>
                      {analysis?.id && (
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/train/ai-trainer/${v.id}/chat`}>
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Chat
                          </Link>
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
