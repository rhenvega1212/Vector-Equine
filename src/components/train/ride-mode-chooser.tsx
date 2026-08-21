"use client";

export type RideMode = "solo" | "with_trainer";

/** After Start — who is on this ride. */
export function RideModeChooser({
  onChoose,
  busy = false,
}: {
  onChoose: (mode: RideMode) => void;
  busy?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-sm space-y-5 px-1 pt-2">
      <div className="space-y-2 text-left">
        <p className="text-[10px] uppercase tracking-[0.28em] text-cream-dim">
          Who&apos;s on this ride
        </p>
        <p className="font-serif text-xl text-cream">
          Solo, or with your trainer?
        </p>
        <p className="text-sm leading-relaxed text-cream/55">
          Solo opens the mic on this phone and arms Vector. With a trainer,
          capture waits until they join the call.
        </p>
      </div>

      <div className="h-px w-full bg-[rgba(209,169,85,0.18)]" aria-hidden />

      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => onChoose("solo")}
          className="min-h-[52px] w-full border border-gold/45 bg-gold px-4 py-3 text-center font-serif text-lg text-ink hover:bg-gold-bright disabled:opacity-50"
        >
          On my own
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onChoose("with_trainer")}
          className="min-h-[52px] w-full border border-gold/30 px-4 py-3 text-center font-serif text-lg text-gold hover:border-gold/55 hover:bg-gold/5 disabled:opacity-50"
        >
          With a trainer
        </button>
      </div>
    </div>
  );
}

export function parseRideMode(raw: string | null | undefined): RideMode | null {
  if (raw === "solo" || raw === "with_trainer") return raw;
  if (raw === "trainer") return "with_trainer";
  return null;
}

export function hrefWithRideMode(baseHref: string, mode: RideMode): string {
  const hasQuery = baseHref.includes("?");
  const url = new URL(
    baseHref.startsWith("http")
      ? baseHref
      : `https://vector.local${baseHref.startsWith("/") ? "" : "/"}${baseHref}`
  );
  url.searchParams.set("mode", mode);
  return `${url.pathname}${url.search}`;
}
