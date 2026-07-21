"use client";

import { MicWarmLink } from "@/components/capture/mic-warm-link";

export function TrainRideCtas({
  planHref,
  liveHref,
}: {
  planHref: string;
  liveHref: string;
}) {
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <MicWarmLink
        href={planHref}
        className="bg-gold text-navy font-semibold hover:bg-gold-bright"
      >
        Plan today&apos;s ride
      </MicWarmLink>
      <MicWarmLink
        href={liveHref}
        variant="outline"
        className="border-gold/40 text-gold hover:bg-gold/10"
      >
        Start ride
      </MicWarmLink>
    </div>
  );
}
