import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { AiUploadForm } from "@/components/train/ai-upload-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, MessageSquare } from "lucide-react";
import { format } from "date-fns";

export default async function PlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: videos } = await supabase
    .from("ai_video_uploads")
    .select(
      `
      id,
      horse,
      notes,
      created_at,
      ai_analyses ( id, status )
    `
    )
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">Plan</p>
        <h1 className="mt-1 font-serif text-3xl">Ask Vector</h1>
        <p className="mt-2 text-muted-foreground">
          Tell Vector your goal for this ride — or upload a video to talk through a past one.
        </p>
        <p className="mt-2 text-sm italic text-gold/90">
          Works alongside your trainer — bring these to your next lesson too.
        </p>
      </div>

      <div className="rounded-xl border border-gold/25 bg-navy p-6 text-cream">
        <p className="font-serif text-lg italic text-gold-bright">
          What do you want to work on today?
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-cream/80">
          <li>Walk warm-up with soft contact</li>
          <li>Transitions within the trot — keep the seat quiet</li>
          <li>One lateral exercise, then cool down</li>
        </ol>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/train/ride/live">
            <Button className="bg-gold text-navy font-semibold hover:bg-gold-bright">Start ride</Button>
          </Link>
          <Link href="/train/sessions/new">
            <Button variant="outline" className="border-gold/30 text-cream hover:bg-white/5">
              Log without live
            </Button>
          </Link>
        </div>
      </div>

      <AiUploadForm />

      {list.length > 0 && (
        <Card className="border-gold/20">
          <CardHeader>
            <CardTitle>Recent uploads</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {list.map((v) => {
                const analysis = analysisByVideo(v);
                return (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-gold/10 p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Video className="h-5 w-5 shrink-0 text-gold/80" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{v.horse || "Untitled"}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(v.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button variant="outline" size="sm" asChild className="border-gold/20">
                        <Link href={`/train/ride/plan/${v.id}`}>Results</Link>
                      </Button>
                      {analysis?.id && (
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/train/ride/plan/${v.id}/chat`}>
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Ask Vector
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
