'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Todo, type TodoItem } from '@/components/dashboard/parts';
import { useDismiss } from './popover';

const REFRESH_MS = 60_000;

/**
 * The alert bell: how much waits for the signed-in person, on every page. Refreshes every minute and when the
 * tab regains focus. Shows nothing when the counts cannot be loaded (for example an account that may not sell yet).
 */
export function AttentionBell<T>({ load, items }: { load: () => Promise<T>; items: (data: T) => TodoItem[] }) {
  const [data, setData] = useState<T | null>(null);
  const [open, setOpen] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);

  useEffect(() => {
    let live = true;
    const run = () =>
      load()
        .then((d) => live && (setData(d), setUnavailable(false)))
        .catch(() => live && setUnavailable(true));
    run();
    const timer = window.setInterval(run, REFRESH_MS);
    const onVisible = () => document.visibilityState === 'visible' && run();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  if (unavailable && !data) return null;
  const list = data ? items(data) : [];
  const total = list.reduce((n, i) => n + i.count, 0);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={total ? `${total} items need attention` : 'Nothing needs attention'}
        aria-expanded={open}
        className="relative grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Bell className="h-[18px] w-[18px]" />
        {total > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-brass px-1 text-[10px] font-bold leading-4 text-topbar">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-80 rounded-xl border border-border bg-card p-4 shadow-lg">
          <p className="text-sm font-semibold text-foreground">Needs attention</p>
          <div className="mt-2" onClick={close}>
            {data ? <Todo items={list} /> : <p className="text-sm text-muted-foreground">Loading…</p>}
          </div>
        </div>
      )}
    </div>
  );
}
