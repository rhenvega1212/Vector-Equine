"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SOCIAL_CONFIG } from "@/lib/social/config";
import { Download, Share2 } from "lucide-react";

export type ShareCardProps = {
  score: number;
  decodedLine: string;
  horseName: string;
  riderFirstName: string;
};

export function OutwardShareButton(props: ShareCardProps) {
  const [open, setOpen] = useState(false);
  if (!SOCIAL_CONFIG.SHARE_OUTWARD_ENABLED) return null;

  return (
    <>
      <Button
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);

  async function renderPng(aspect: "9:16" | "1:1") {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const w = aspect === "9:16" ? 1080 : 1080;
    const h = aspect === "9:16" ? 1920 : 1080;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Navy field
    ctx.fillStyle = "#0E1729";
    ctx.fillRect(0, 0, w, h);

    // Soft cream band
    ctx.fillStyle = "#FCF2E6";
    ctx.fillRect(0, h * 0.62, w, h * 0.38);

    // Diamond mark
    ctx.fillStyle = "#D1A955";
    ctx.beginPath();
    const cx = w / 2;
    const cy = h * 0.18;
    const s = 28;
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s, cy);
    ctx.lineTo(cx, cy + s);
    ctx.lineTo(cx - s, cy);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#D1A955";
    ctx.font = "600 36px Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText("VECTOR", cx, cy + 80);

    ctx.fillStyle = "#FCF2E6";
    ctx.font = "400 120px Georgia, serif";
    ctx.fillText(String(score), cx, h * 0.4);

    ctx.font = "400 28px system-ui, sans-serif";
    ctx.fillStyle = "rgba(252,242,230,0.7)";
    ctx.fillText("execution", cx, h * 0.4 + 48);

    // Decoded line on cream
    ctx.fillStyle = "#1A2133";
    ctx.font = "italic 42px Georgia, serif";
    wrapText(ctx, decodedLine.slice(0, 120), cx, h * 0.72, w * 0.8, 52);

    ctx.font = "500 28px system-ui, sans-serif";
    ctx.fillStyle = "#0E1729";
    ctx.fillText(`${riderFirstName} · ${horseName}`, cx, h * 0.88);

    ctx.font = "400 22px system-ui, sans-serif";
    ctx.fillStyle = "#D1A955";
    ctx.fillText("You ride. Vector assists.", cx, h * 0.93);

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/png");
    });
  }

  async function download() {
    setBusy(true);
    try {
      const blob = await renderPng("9:16");
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vector-ride-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  async function shareNative() {
    setBusy(true);
    try {
      const blob = await renderPng("9:16");
      if (!blob) return;
      const file = new File([blob], "vector-ride.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Vector ride",
          text: "You ride. Vector assists.",
        });
      } else {
        await download();
      }
    } catch {
      await download();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-xl border border-gold/20 bg-background p-6 shadow-xl">
        <h2 className="font-serif text-2xl">Share this ride</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Post-ready 9:16 card for Stories / Reels / TikTok. No health details.
        </p>
        <div className="mt-4 overflow-hidden rounded-lg border border-gold/20 bg-navy aspect-[9/16] max-h-72 mx-auto w-40 relative">
          <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center text-cream">
            <span className="text-gold text-xs tracking-[0.2em]">VECTOR</span>
            <span className="mt-2 font-serif text-4xl text-gold">{score}</span>
            <span className="mt-3 text-[10px] italic text-gold-bright line-clamp-3">
              {decodedLine}
            </span>
            <span className="mt-auto text-[10px]">
              {riderFirstName} · {horseName}
            </span>
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            className="bg-gold text-navy font-semibold hover:bg-gold-bright"
            onClick={shareNative}
            disabled={busy}
          >
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
          <Button variant="outline" onClick={download} disabled={busy}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          <Button variant="ghost" onClick={onClose}>
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
