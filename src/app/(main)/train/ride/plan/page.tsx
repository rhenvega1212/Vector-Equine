"use client";

import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";
import { AiUploadForm } from "@/components/train/ai-upload-form";
import { MicWarmLink } from "@/components/capture/mic-warm-link";

const EXERCISES = [
  {
    name: "Collect on a 10 m circle",
    why: "Get the canter carrying before you ask it to turn.",
  },
  {
    name: "Spiral accordion",
    why: "In and out to teach him to bring the hind leg under.",
  },
  {
    name: "Quarter pirouettes on a square",
    why: "One quarter per corner; reward the sit, rebuild the canter.",
  },
  {
    name: "Triangle to X",
    why: "Then ask for the half-pirouette and Vector will score it.",
  },
];

function PlanPageInner() {
  const searchParams = useSearchParams();
  const horseId = searchParams.get("horseId");
  const liveHref = horseId
    ? `/train/ride/live?horseId=${horseId}`
    : "/train/ride/live";

  return (
    <div className="relative space-y-6 pb-28">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
          Plan
        </p>
        <h1 className="mt-1 font-serif text-3xl text-cream">Today&apos;s ride.</h1>
        <p className="mt-1 text-sm text-cream/50">Ask Vector for a plan — then ride it.</p>
      </header>

      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md border border-gold/10 bg-[#1A2440] px-4 py-3 text-sm text-cream/90">
          <p>
            We&apos;re chasing stronger canter pirouettes — he doesn&apos;t sit and he spins out.
            Give me exercises to build it from the ground up.
          </p>
          <p className="mt-2 text-right text-[10px] text-cream/40">🎤 spoken</p>
        </div>
      </div>

      <div className="flex gap-3">
        <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/40 text-gold">
          ◇
        </span>
        <div className="flex-1 space-y-4 rounded-2xl rounded-tl-md border border-gold/15 bg-[#131C31] p-4">
          <p className="font-serif text-cream">
            Got it — sit and carry, not spin. Build it in three steps.
          </p>

          <ol className="space-y-3">
            {EXERCISES.map((ex, i) => (
              <li
                key={ex.name}
                className="rounded-lg border border-gold/10 bg-[#1A2440]/40 px-3 py-3"
              >
                <p className="text-sm font-medium text-cream">
                  <span className="text-gold">{i + 1}.</span> {ex.name}
                </p>
                <p className="mt-1 text-xs text-cream/50">{ex.why}</p>
              </li>
            ))}
          </ol>

          <div className="rounded-lg border border-gold/15 bg-navy p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-cream/50">
              Quarter pirouettes on a square
            </p>
            <svg viewBox="0 0 200 120" className="mx-auto h-36 w-full max-w-xs text-gold/50">
              <rect
                x="20"
                y="10"
                width="160"
                height="100"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              />
              <rect
                x="55"
                y="30"
                width="90"
                height="60"
                fill="none"
                stroke="#D1A955"
                strokeWidth="1.5"
              />
              <path d="M55 40 Q50 30 60 30" fill="none" stroke="#F0C967" strokeWidth="1.5" />
              <path d="M145 30 Q155 30 150 40" fill="none" stroke="#F0C967" strokeWidth="1.5" />
              <path d="M145 80 Q150 90 140 90" fill="none" stroke="#F0C967" strokeWidth="1.5" />
              <path d="M55 90 Q45 90 50 80" fill="none" stroke="#F0C967" strokeWidth="1.5" />
              <circle cx="55" cy="30" r="2" fill="#D1A955" />
              <circle cx="145" cy="30" r="2" fill="#D1A955" />
              <circle cx="145" cy="90" r="2" fill="#D1A955" />
              <circle cx="55" cy="90" r="2" fill="#D1A955" />
            </svg>
          </div>

          <p className="text-xs text-cream/50">
            Works alongside your trainer — bring these to your next lesson too.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gold/15 bg-[#131C31] p-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
          Ask about a past ride
        </p>
        <p className="text-sm text-cream/50">
          Upload a video and ask Vector about what happened — works alongside your trainer.
        </p>
        <AiUploadForm />
      </div>

      <div className="fixed bottom-20 left-0 right-0 z-30 mx-auto flex max-w-lg flex-col gap-2 px-4 md:bottom-8">
        <div className="rounded-full border border-gold/20 bg-[#131C31] px-4 py-3 text-center text-sm text-cream/40">
          Hold to talk to Vector · 🎤
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 border-gold/40 text-gold hover:bg-gold/10">
            Set as today&apos;s plan
          </Button>
          <div className="flex-1">
            <MicWarmLink
              href={liveHref}
              className="w-full bg-gold text-navy font-semibold hover:bg-gold-bright"
            >
              Start ride
            </MicWarmLink>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlanPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-4">
          <p className="text-sm text-cream/50">Loading plan…</p>
        </div>
      }
    >
      <PlanPageInner />
    </Suspense>
  );
}
