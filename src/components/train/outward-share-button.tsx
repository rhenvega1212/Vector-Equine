"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SOCIAL_CONFIG } from "@/lib/social/config";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2, Share2 } from "lucide-react";

export type ShareCardProps = {
  score: number;
  decodedLine: string;
  horseName: string;
  riderFirstName: string;
};

type Aspect = "9:16" | "1:1";

const ASPECTS: { id: Aspect; label: string; hint: string }[] = [
  { id: "9:16", label: "9:16", hint: "Stories / Reels / TikTok" },
  { id: "1:1", label: "1:1", hint: "Feed post" },
];

export function OutwardShareButton(props: ShareCardProps) {
  const [open, setOpen] = useState(false);
  if (!SOCIAL_CONFIG.SHARE_OUTWARD_ENABLED) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="border-gold/30"
        onClick={() => setOpen(true)}
      >
        <Share2 className="mr-2 h-4 w-4" />
        Share
      </Button>
      {open && <ShareCardModal {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function ShareCardModal({
  score,
  decodedLine,
  horseName,
  riderFirstName,
  onClose,
}: ShareCardProps & { onClose: () => void }) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [aspect, setAspect] = useState<Aspect>("9:16");
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const safeLine = decodedLine.trim().slice(0, 120) || "Closer than it felt.";
  const safeHorse = horseName.trim().split(/\s+/)[0] || "Horse";
  const safeRider = riderFirstName.trim().split(/\s+/)[0] || "Rider";
  const displayScore =
    Number.isFinite(score) && score > 0
      ? score >= 10
        ? score.toFixed(0)
        : score % 1 === 0
          ? String(score)
          : score.toFixed(1)
      : "—";

  const renderPng = useCallback(
    async (ratio: Aspect): Promise<Blob | null> => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const w = 1080;
      const h = ratio === "9:16" ? 1920 : 1080;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      // Navy field
      ctx.fillStyle = "#0E1729";
      ctx.fillRect(0, 0, w, h);

      // Subtle gold edge rule (flat, no glow)
      ctx.strokeStyle = "rgba(209,169,85,0.35)";
      ctx.lineWidth = 4;
      ctx.strokeRect(48, 48, w - 96, h - 96);

      // Cream panel for quote + names
      const creamTop = ratio === "9:16" ? h * 0.58 : h * 0.55;
      ctx.fillStyle = "#FCF2E6";
      ctx.fillRect(0, creamTop, w, h - creamTop);

      // Diamond mark
      const cx = w / 2;
      const cy = ratio === "9:16" ? h * 0.16 : h * 0.14;
      const s = ratio === "9:16" ? 32 : 26;
      ctx.fillStyle = "#D1A955";
      ctx.beginPath();
      ctx.moveTo(cx, cy - s);
      ctx.lineTo(cx + s, cy);
      ctx.lineTo(cx, cy + s);
      ctx.lineTo(cx - s, cy);
      ctx.closePath();
      ctx.fill();

      // Wordmark
      ctx.fillStyle = "#D1A955";
      ctx.font = "600 34px Georgia, 'Times New Roman', serif";
      ctx.textAlign = "center";
      ctx.fillText("V E C T O R", cx, cy + s + 56);

      // Score
      const scoreY = ratio === "9:16" ? h * 0.38 : h * 0.34;
      ctx.fillStyle = "#FCF2E6";
      ctx.font = `400 ${ratio === "9:16" ? 140 : 110}px Georgia, 'Times New Roman', serif`;
      ctx.fillText(displayScore, cx, scoreY);

      ctx.font = "500 26px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "rgba(252,242,230,0.55)";
      ctx.fillText("EXECUTION", cx, scoreY + 52);

      // Decoded line on cream
      ctx.fillStyle = "#1A2133";
      ctx.font = `italic ${ratio === "9:16" ? 44 : 38}px Georgia, 'Times New Roman', serif`;
      const quoteY = creamTop + (ratio === "9:16" ? 100 : 80);
      wrapText(ctx, `“${safeLine}”`, cx, quoteY, w * 0.78, ratio === "9:16" ? 56 : 48);

      // Rider · Horse (first names only — no health / extra PII)
      ctx.font = "500 30px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#0E1729";
      ctx.fillText(`${safeRider} · ${safeHorse}`, cx, h * 0.88);

      // Tagline
      ctx.font = "400 24px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#D1A955";
      ctx.fillText("You ride. Vector assists.", cx, h * 0.93);

      return new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/png");
      });
    },
    [displayScore, safeHorse, safeLine, safeRider]
  );

  // Live preview when aspect or content changes
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      const blob = await renderPng(aspect);
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setPreviewUrl(objectUrl);
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [aspect, renderPng]);

  async function download() {
    setBusy(true);
    try {
      const blob = await renderPng(aspect);
      if (!blob) {
        toast({
          title: "Could not create card",
          description: "Try again in a moment.",
          variant: "destructive",
        });
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vector-ride-${aspect.replace(":", "x")}-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Card downloaded",
        description: `${aspect} PNG ready for Stories, Reels, or TikTok.`,
      });
    } catch {
      toast({
        title: "Download failed",
        description: "Try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function shareNative() {
    setBusy(true);
    try {
      const blob = await renderPng(aspect);
      if (!blob) {
        toast({
          title: "Could not create card",
          description: "Try again in a moment.",
          variant: "destructive",
        });
        return;
      }
      const file = new File([blob], "vector-ride.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Vector ride",
          text: "You ride. Vector assists.",
        });
        toast({ title: "Shared", description: "Opened your share sheet." });
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `vector-ride-${aspect.replace(":", "x")}-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast({
          title: "Downloaded instead",
          description: "Native share isn’t available here — PNG saved.",
        });
      }
    } catch (err) {
      // User cancel on share sheet is fine; other errors fall back to download
      const aborted =
        err instanceof DOMException &&
        (err.name === "AbortError" || err.name === "NotAllowedError");
      if (aborted) return;
      try {
        const blob = await renderPng(aspect);
        if (!blob) throw new Error("no blob");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `vector-ride-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast({
          title: "Downloaded instead",
          description: "Share didn’t complete — PNG saved.",
        });
      } catch {
        toast({
          title: "Share failed",
          description: "Try Download.",
          variant: "destructive",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-card-title"
    >
      <div className="w-full max-w-md rounded-xl border border-gold/25 bg-navy p-5 text-cream shadow-xl sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
          Outward share
        </p>
        <h2 id="share-card-title" className="mt-1 font-serif text-2xl text-cream">
          Share this ride
        </h2>
        <p className="mt-1 text-sm text-cream/55">
          Post-ready card for IG / TikTok. First name + horse only — no health details.
        </p>

        <div className="mt-4 inline-flex rounded-lg border border-gold/25 p-0.5">
          {ASPECTS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAspect(a.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                aspect === a.id
                  ? "bg-gold text-navy"
                  : "text-cream/60 hover:text-cream"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-cream/40">
          {ASPECTS.find((a) => a.id === aspect)?.hint}
        </p>

        <div
          className={`mt-4 mx-auto overflow-hidden rounded-lg border border-gold/20 bg-[#0E1729] ${
            aspect === "9:16" ? "aspect-[9/16] max-h-80 w-44" : "aspect-square max-h-64 w-64"
          }`}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Share card preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-cream/40">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" aria-hidden />

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            type="button"
            className="bg-gold text-navy font-semibold hover:bg-gold-bright"
            onClick={shareNative}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="mr-2 h-4 w-4" />
            )}
            Share
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-gold/40 text-gold hover:bg-gold/10"
            onClick={download}
            disabled={busy}
          >
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-cream/70"
            onClick={onClose}
            disabled={busy}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, yy);
      line = word + " ";
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, yy);
}
