export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

/** Stands in for a list or page while it loads. Announces "Loading" to screen readers. */
export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true" className="space-y-3 py-6">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-6 w-1/3" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
