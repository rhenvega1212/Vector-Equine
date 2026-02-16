import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, ArrowLeft } from "lucide-react";
import { format } from "date-fns";

const SCORE_LABELS: Record<string, string> = {
  rhythm: "Rhythm",
  relaxation: "Relaxation",
  connection: "Connection",
  impulsion: "Impulsion",
  straightness: "Straightness",
  collection: "Collection",
};

interface AnalysisResult {
  summary?: string;
  scores?: Record<string, number>;
  keyMoments?: { timestamp: string; note: string }[];
  suggestedFocus?: string;
}

export default async function AiTrainerResultPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: video, error: videoError } = await supabase
    .from("ai_video_uploads")
    .select("id, file_url, horse, notes, created_at")
    .eq("id", videoId)
    .eq("user_id", user.id)
    .single();

  if (videoError || !video) notFound();

  const { data: analysis } = await supabase
    .from("ai_analyses")
    .select("*")
    .eq("video_id", videoId)
    .single();

  if (!analysis || analysis.status !== "complete") {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/train/ai-trainer" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to AI Trainer
          </Link>
        </Button>
        <Card className="border-cyan-400/20">
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              {analysis?.status === "processing" || analysis?.status === "pending"
                ? "Analysis in progress. Check back shortly."
                : "Analysis not available."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const result = (analysis.result_json ?? {}) as AnalysisResult;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/train/ai-trainer" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to AI Trainer
          </Link>
        </Button>
        <Button asChild>
          <Link href={`/train/ai-trainer/${videoId}/chat`} className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Chat about this ride
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Analysis</h1>
        <p className="text-muted-foreground">
          {video.horse && `${video.horse} · `}
          {format(new Date(video.created_at), "MMM d, yyyy")}
        </p>
      </div>

      {result.summary && (
        <Card className="border-cyan-400/20 bg-slate-800/30">
          <CardHeader>
            <CardTitle className="text-lg">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{result.summary}</p>
          </CardContent>
        </Card>
      )}

      {result.scores && Object.keys(result.scores).length > 0 && (
        <Card className="border-cyan-400/20">
          <CardHeader>
            <CardTitle className="text-lg">Performance scores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(result.scores).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center rounded-md bg-cyan-400/5 border border-cyan-400/10 px-3 py-2">
                  <span className="text-sm font-medium">{SCORE_LABELS[key] ?? key}</span>
                  <span className="text-cyan-400 font-semibold">{value}/5</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {result.keyMoments && result.keyMoments.length > 0 && (
        <Card className="border-cyan-400/20">
          <CardHeader>
            <CardTitle className="text-lg">Key moments</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {result.keyMoments.map((m, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="shrink-0 font-mono text-cyan-400/90">{m.timestamp}</span>
                  <span className="text-muted-foreground">{m.note}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {result.suggestedFocus && (
        <Card className="border-cyan-400/20">
          <CardHeader>
            <CardTitle className="text-lg">Suggested next focus</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{result.suggestedFocus}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
