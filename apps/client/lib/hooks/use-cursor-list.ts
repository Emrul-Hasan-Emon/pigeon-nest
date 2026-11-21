'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '@/lib/api/http';
import type { CursorPage, Params } from '@/types/review';

/**
 * A list that pages by cursor: it starts over when `filters` change and appends
 * the next page on `more()`. `reload()` starts over with the same filters.
 */
export function useCursorList<T>(fetcher: (params: Params) => Promise<CursorPage<T>>, filters: Params = {}, pageSize = 10) {
  const key = JSON.stringify(filters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stable = useMemo(() => filters, [key]);
  const [rows, setRows] = useState<T[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const fetchRef = useRef(fetcher);
  // reload() refreshes in place: rows stay on screen, so open threads and dialogs are not torn down
  const quiet = useRef(false);
  useEffect(() => {
    fetchRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    let live = true;
    const silent = quiet.current;
    quiet.current = false;
    if (!silent) setLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    fetchRef
      .current({ ...stable, limit: pageSize })
      .then((r) => {
        if (!live) return;
        setRows(r.results);
        setNext(r.nextCursor);
      })
      .catch((e) => {
        if (!live) return;
        setRows([]);
        setNext(null);
        setError(e instanceof ApiError ? e.message : 'Could not load this. Try again.');
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [stable, pageSize, version]);

  const more = useCallback(async () => {
    if (next === null) return;
    setMoreLoading(true);
    try {
      const r = await fetchRef.current({ ...stable, limit: pageSize, cursor: next });
      setRows((c) => [...c, ...r.results]);
      setNext(r.nextCursor);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load more.');
    } finally {
      setMoreLoading(false);
    }
  }, [next, stable, pageSize]);

  const reload = useCallback(() => {
    quiet.current = true;
    setVersion((v) => v + 1);
  }, []);
  return { rows, setRows, loading, error, hasMore: next !== null, more, moreLoading, reload };
}
