export function DebriefComingSoon({
  title,
  promise,
}: {
  title: string;
  promise: string;
}) {
  return (
    <section className="rounded-xl border border-dashed border-gold/20 bg-[#131C31]/50 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold/70">
          {title}
        </p>
        <span className="rounded border border-gold/25 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gold/60">
          Coming soon
        </span>
      </div>
      <p className="mt-2 text-sm text-cream/40">{promise}</p>
    </section>
  );
}
