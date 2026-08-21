"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  MIC_BLOCKED_HELP,
  requestMicAccess,
} from "@/lib/capture/mic-preflight";
import { Loader2 } from "lucide-react";

/**
 * CTA that asks for mic on the user gesture, then navigates to Live/Plan.
 * iOS Safari will not show a permission prompt without a tap.
 */
export function MicWarmLink({
  href,
  children,
  variant = "default",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "default" | "outline";
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setHelp(null);
    const result = await requestMicAccess();
    if (!result.ok && result.blocked) {
      setHelp(result.message || MIC_BLOCKED_HELP);
      setBusy(false);
      // Still allow navigation so they can retry on Live with sticky help
      // but keep instructions visible here first
      return;
    }
    if (result.ok) {
      result.stream.getTracks().forEach((t) => t.stop());
    }
    setBusy(false);
    router.push(href);
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={variant === "outline" ? "outline" : "default"}
        className={className}
        disabled={busy}
        onClick={() => void onClick()}
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Checking mic…
          </>
        ) : (
          children
        )}
      </Button>
      {help && (
        <div className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-cream/85 space-y-2">
          <p>{help}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md bg-gold px-3 py-1.5 text-[11px] font-semibold text-navy"
              onClick={() => void onClick()}
            >
              Try Allow microphone again
            </button>
            <button
              type="button"
              className="rounded-md border border-gold/30 px-3 py-1.5 text-[11px] text-cream/70"
              onClick={() => router.push(href)}
            >
              Continue anyway
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
