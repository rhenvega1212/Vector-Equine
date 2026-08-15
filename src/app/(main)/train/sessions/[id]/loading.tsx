/**
 * Fast shell while a single ride streams in.
 */
export default function RideLoading() {
  return (
    <div
      className="min-h-[70vh] px-[26px] pt-4"
      aria-busy="true"
      aria-label="Loading ride"
    >
      <div className="h-3 w-16 rounded-sm bg-gold/20" />
      <div className="mt-[30px] h-3 w-40 rounded-sm bg-cream/10" />
      <div className="mt-3.5 h-9 w-3/4 max-w-sm rounded-sm bg-cream/15" />
      <div className="mt-[13px] h-3 w-48 rounded-sm bg-cream/5" />
      <div className="mt-[52px] aspect-video w-full bg-navy-3/80" />
      <div className="mt-10 h-px bg-[var(--line)]" />
    </div>
  );
}
