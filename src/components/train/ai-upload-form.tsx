"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Upload, Video, AlertCircle } from "lucide-react";

type Status = "idle" | "uploading" | "processing" | "complete" | "error";

export function AiUploadForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>("idle");
  const [horse, setHorse] = useState("");
  const [notes, setNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ["video/mp4", "video/webm", "video/quicktime"];
    if (!validTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload MP4, WebM, or QuickTime video.", variant: "destructive" });
      return;
    }
    setErrorMessage(null);
    setStatus("uploading");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus("error");
        setErrorMessage("Please sign in to upload.");
        return;
      }

      const ext = file.name.split(".").pop() || "mp4";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("ai-training-videos")
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (uploadError) {
        setStatus("error");
        setErrorMessage(uploadError.message);
        toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
        return;
      }

      setStatus("processing");
      const { data: urlData } = supabase.storage.from("ai-training-videos").getPublicUrl(path);
      const fileUrl = urlData.publicUrl;

      const res = await fetch("/api/train/ai/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_url: fileUrl, horse: horse || null, notes: notes || null }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus("error");
        setErrorMessage(data.error ?? "Analysis failed");
        toast({ title: "Analysis failed", description: data.error ?? "Something went wrong", variant: "destructive" });
        return;
      }

      const { video_id } = await res.json();
      setStatus("complete");
      toast({ title: "Analysis complete", description: "Your ride has been analyzed." });
      router.push(`/train/ai-trainer/${video_id}`);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
      toast({ title: "Error", description: "Upload or analysis failed.", variant: "destructive" });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Card className="border-cyan-400/20 bg-slate-800/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5 text-cyan-400" />
          Upload training video
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="horse">Horse (optional)</Label>
          <Input
            id="horse"
            value={horse}
            onChange={(e) => setHorse(e.target.value)}
            placeholder="Horse name"
            disabled={status === "uploading" || status === "processing"}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any context for this ride..."
            rows={2}
            disabled={status === "uploading" || status === "processing"}
          />
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={status === "uploading" || status === "processing"}
          className="w-full sm:w-auto"
        >
          {status === "uploading" || status === "processing" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {status === "uploading" ? "Uploading…" : "Analyzing…"}
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Choose video file
            </>
          )}
        </Button>
        {status === "error" && errorMessage && (
          <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errorMessage}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
