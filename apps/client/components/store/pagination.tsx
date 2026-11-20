'use client';

/** Numbered pages with first/last always visible and a window around the current page. */
function pageList(page: number, totalPages: number): (number | 'gap')[] {
  const wanted = new Set([1, totalPages, page - 1, page, page + 1]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const base =
    'flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal';
  return (
    <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className={`${base} border border-st-line bg-white hover:bg-st-ink hover:text-white disabled:pointer-events-none disabled:opacity-40`}>
        Previous
      </button>
      {pageList(page, totalPages).map((p, i) =>
        p === 'gap' ? (
          <span key={`gap-${i}`} className="px-1 text-st-slate" aria-hidden>…</span>
        ) : (
          <button
            key={p}
            type="button"
            aria-current={p === page ? 'page' : undefined}
            aria-label={`Page ${p}`}
            onClick={() => onChange(p)}
            className={`${base} ${p === page ? 'bg-st-ink font-semibold text-white' : 'border border-st-line bg-white hover:bg-st-dove'}`}
          >
            {p}
          </button>
        ),
      )}
      <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)} className={`${base} border border-st-line bg-white hover:bg-st-ink hover:text-white disabled:pointer-events-none disabled:opacity-40`}>
        Next
      </button>
    </nav>
  );
}
