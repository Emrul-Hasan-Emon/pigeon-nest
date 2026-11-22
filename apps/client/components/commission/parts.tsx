'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { money, outlineButton, useApiError } from '@/components/orders/ui';
import type { CommissionRole, CommissionRule, Page } from '@/types/commission';

export const th = 'px-4 py-3 text-left font-medium text-muted-foreground';
export const td = 'px-4 py-3';

/** "10%" or "50 per item". */
export function ruleLabel(rule: { type: string | null; value: number | null }) {
  if (rule.type === null || rule.value === null) return '—';
  return rule.type === 'percentage' ? `${rule.value}%` : `${money(rule.value)} per item`;
}

export function ruleText(rule: CommissionRule & { source?: string }) {
  return `${ruleLabel(rule)}${rule.source ? (rule.source === 'seller' ? ' (own rate)' : ' (global rate)') : ''}`;
}

export function Cards({ items }: { items: { label: string; value: string; hint?: string; tone?: 'warn' | 'good' }[] }) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map((c) => (
        <div key={c.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">{c.label}</p>
          <p className={`mt-1 text-2xl font-bold ${c.tone === 'warn' ? 'text-amber-700' : c.tone === 'good' ? 'text-emerald-700' : 'text-foreground'}`}>{c.value}</p>
          {c.hint && <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>}
        </div>
      ))}
    </div>
  );
}

/**
 * A list with cursor paging: refetches from the start when the filters change,
 * and appends the next page on "Load more".
 */
export function usePagedList<T>(
  role: CommissionRole,
  fetcher: (params: Record<string, string | number | boolean | undefined>) => Promise<Page<T>>,
  filters: Record<string, string>,
  fixed: Record<string, string | number | undefined> = {},
  pageSize = 20,
) {
  const errorMessage = useApiError(role);
  const { showToast } = useToast();
  // Callers build a new object each render; key on its contents so a refetch only follows a real change.
  const filtersKey = JSON.stringify(filters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableFilters = useMemo(() => filters, [filtersKey]);
  const debounced = useDebouncedValue(stableFilters);
  const [rows, setRows] = useState<T[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchRef = useRef(fetcher);
  useEffect(() => {
    fetchRef.current = fetcher;
  }, [fetcher]);
  const fixedKey = JSON.stringify(fixed);

  const build = useCallback(
    (cursor?: number) => {
      const p: Record<string, string | number | boolean | undefined> = { ...JSON.parse(fixedKey), limit: pageSize, cursor };
      for (const [k, v] of Object.entries(debounced)) if (v.trim() !== '') p[k] = v.trim();
      return p;
    },
    [debounced, fixedKey, pageSize],
  );

  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    fetchRef
      .current(build())
      .then((r) => {
        if (!live) return;
        setRows(r.results);
        setNext(r.nextCursor);
      })
      .catch((e) => {
        if (!live) return;
        setRows([]);
        setNext(null);
        setError(errorMessage(e, 'Failed to load.'));
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [build]);

  async function more() {
    if (next === null) return;
    setMoreLoading(true);
    try {
      const r = await fetchRef.current(build(next));
      setRows((c) => [...c, ...r.results]);
      setNext(r.nextCursor);
    } catch {
      showToast('Failed to load more.', 'error');
    } finally {
      setMoreLoading(false);
    }
  }
  return { rows, loading, error, hasMore: next !== null, more, moreLoading };
}

export function ListFrame({
  loading,
  error,
  hasMore,
  more,
  moreLoading,
  children,
}: {
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  more: () => void;
  moreLoading: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      {error && <p role="alert" className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="py-10 text-center text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">{children}</div>
      )}
      {!loading && hasMore && (
        <div className="mt-4 flex justify-center">
          <button type="button" onClick={more} disabled={moreLoading} className={outlineButton}>{moreLoading ? 'Loading…' : 'Load more'}</button>
        </div>
      )}
    </>
  );
}
