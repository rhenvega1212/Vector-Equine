/**
 * Instant shell while Vector pages stream in — keeps navy chrome, no blank white flash.
 */
export default function TrainLoading() {
  return (
    <div className="min-h-[70vh] px-7 pt-4" aria-busy="true" aria-label="Loading">
      <div className="mb-10 h-3 w-28 rounded-sm bg-gold/20" />
      <div className="h-14 w-3/4 max-w-xs rounded-sm bg-cream/10" />
      <div className="mt-4 h-3 w-48 rounded-sm bg-cream/5" />
      <div className="mt-10 h-px bg-[var(--line)]" />
      <div className="mt-8 space-y-3">
        <div className="h-3 w-20 rounded-sm bg-gold/15" />
        <div className="h-8 w-56 rounded-sm bg-cream/10" />
        <div className="h-16 w-full max-w-sm rounded-sm bg-cream/5" />
      </div>
    </div>
  );
}
