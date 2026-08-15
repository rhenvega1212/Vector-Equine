import { cn } from "@/lib/utils";

/**
 * Shared navy atmosphere: gradient light source, vignette, grain.
 * Optional hero photo sits behind as atmosphere — content stays above at z-10.
 */
export function AtmosphereScreen({
  children,
  className,
  heroImageUrl,
}: {
  children: React.ReactNode;
  className?: string;
  /** Soft full-bleed horse photo behind the composition (not a second hero). */
  heroImageUrl?: string | null;
}) {
  return (
    <div className={cn("relative isolate min-h-full overflow-hidden", className)}>
      {heroImageUrl ? (
        <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImageUrl}
            alt=""
            decoding="async"
            fetchPriority="low"
            className="absolute inset-0 h-full w-full object-cover object-[center_28%] opacity-[0.38]"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(12,18,32,0.55) 0%, rgba(10,17,34,0.78) 42%, rgba(10,17,34,0.96) 78%, #0a1122 100%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 62% at 50% 6%, rgba(209,169,85,0.10) 0%, rgba(209,169,85,0) 58%)",
            }}
          />
        </div>
      ) : (
        <div className="ve-atmos" aria-hidden />
      )}
      <div className="ve-vig" aria-hidden />
      <div className="ve-grain" aria-hidden />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
