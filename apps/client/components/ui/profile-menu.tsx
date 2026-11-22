'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { useDismiss } from './popover';

export interface Who {
  name: string;
  email?: string | null;
  role?: string | null;
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

/** The signed-in person: initials, name, an optional role line and the log-out action. */
export function ProfileMenu({ load, fallbackName, onLogout }: { load: () => Promise<Who>; fallbackName: string; onLogout: () => void }) {
  const [me, setMe] = useState<Who | null>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);

  useEffect(() => {
    load().then(setMe).catch(() => undefined);
  }, [load]);

  const name = me?.name ?? fallbackName;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:bg-muted"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-brass-soft text-xs font-semibold text-brass-ink ring-1 ring-brass/30">{initials(name)}</span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-medium text-foreground">{name}</span>
          {me?.role && <span className="block text-xs text-muted-foreground">{me.role}</span>}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-30 w-60 rounded-xl border border-border bg-card p-2 shadow-lg">
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-foreground">{name}</p>
            {me?.email && <p className="truncate text-xs text-muted-foreground">{me.email}</p>}
          </div>
          <div className="my-1 border-t border-border" />
          <button type="button" role="menuitem" onClick={onLogout} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted">
            <LogOut className="h-4 w-4 text-muted-foreground" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
