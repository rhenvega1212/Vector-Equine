"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { AtmosphereScreen } from "@/components/train/atmosphere-screen";

/** First five minutes: horse name only — unlocks Live. */
export function HorseNameSetup() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("What's your horse's name?");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/train/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : Array.isArray(data.error)
              ? data.error[0]?.message || "Could not save"
              : "Could not save";
        setError(msg);
        return;
      }
      router.push("/train");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AtmosphereScreen className="min-h-[70vh] px-7 pt-10 sm:pt-14">
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-gold">
        Step 1 · Your horse
      </p>
      <h1 className="mt-4 font-[Georgia,'Times_New_Roman',serif] text-3xl text-cream sm:text-4xl">
        What&apos;s your horse&apos;s name?
      </h1>
      <p className="mt-3 max-w-md font-[Georgia,'Times_New_Roman',serif] text-lg italic text-gold">
        That&apos;s enough to start. You can fill in the rest later.
      </p>

      <form onSubmit={onSubmit} className="mt-10 max-w-md space-y-6">
        {error ? (
          <p className="text-sm text-watch">{error}</p>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="horse_name" className="text-cream-dim">
            Horse name
          </Label>
          <Input
            id="horse_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Remy"
            autoFocus
            className="h-12 border-gold/25 bg-white/[0.04] text-cream placeholder:text-cream/35 focus-visible:ring-gold/50"
            maxLength={120}
          />
        </div>
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-gold font-semibold text-navy hover:bg-gold-bright"
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Continue
        </Button>
      </form>
    </AtmosphereScreen>
  );
}
