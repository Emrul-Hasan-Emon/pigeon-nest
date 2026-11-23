'use client';

import { useState } from 'react';

/**
 * The filters of a list in one card: the ones people use all the time in front, the rest behind "More filters".
 * Opens by itself when one of the hidden filters is already in use, so an active filter is never out of sight.
 */
export function FilterPanel({
  children,
  more,
  moreActive = false,
  activeCount,
  onClear,
}: {
  children: React.ReactNode;
  more?: React.ReactNode;
  moreActive?: boolean;
  activeCount: number;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(moreActive);
  return (
    <div className="mb-5 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>
      {more && open && <div className="mt-3 grid grid-cols-2 items-end gap-3 border-t border-border pt-3 md:grid-cols-4">{more}</div>}
      {(more || activeCount > 0) && (
        <div className="mt-3 flex items-center justify-between text-sm">
          {more ? (
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="font-medium text-primary hover:underline">
              {open ? 'Fewer filters' : 'More filters'}
            </button>
          ) : (
            <span />
          )}
          {activeCount > 0 && (
            <button type="button" onClick={onClear} className="text-muted-foreground hover:text-foreground">
              Clear {activeCount === 1 ? 'filter' : `${activeCount} filters`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** A labelled field for the filter grid, so dates and text boxes line up. */
export function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-muted-foreground">
      {label}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}
