'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';

const LABELS: Record<string, string> = { ui: 'UI', sku: 'SKU', new: 'New', commission: 'System commission', onboarding: 'Seller setup' };

function labelFor(segment: string) {
  if (/^\d+$/.test(segment)) return `#${segment}`;
  return LABELS[segment] ?? segment.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

// A detail page tells the trail its record's name (a product's name, an order number), so the last step reads
// "Blue Bar Racing Homer" and not "#1721".
const TitleContext = createContext<{ title: string | null; setTitle: (t: string | null) => void }>({ title: null, setTitle: () => undefined });

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  return <TitleContext.Provider value={{ title, setTitle }}>{children}</TitleContext.Provider>;
}

/** Call from a detail or edit page with the record's name. Pass nothing while it is still loading. */
export function useBreadcrumbTitle(title: string | null | undefined) {
  const { setTitle } = useContext(TitleContext);
  useEffect(() => {
    setTitle(title ?? null);
    return () => setTitle(null);
  }, [title, setTitle]);
}

const LAST_KEY = 'nav:last';
const fromKey = (path: string) => `nav:from:${path}`;
const store = {
  get: (k: string) => {
    try {
      return window.sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      window.sessionStorage.setItem(k, v);
    } catch {
      // Private window or blocked storage: the trail simply falls back to the path.
    }
  },
};

/**
 * Where the person is, each earlier step a link. It follows the page's own path ("Seller / Products / Blue Bar Racing
 * Homer"), except when the person came from another list or the dashboard: then it shows the way they came
 * ("Seller / Dashboard / Blue Bar Racing Homer"), so the trail matches what they did.
 */
export function Breadcrumbs({ rootLabel, rootPath, homeHref }: { rootLabel: string; rootPath: string; homeHref: string }) {
  const pathname = usePathname();
  const { title } = useContext(TitleContext);
  const [from, setFrom] = useState<string | null>(null);

  useEffect(() => {
    const last = store.get(LAST_KEY);
    if (last && last !== pathname) store.set(fromKey(pathname), last);
    store.set(LAST_KEY, pathname);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFrom(store.get(fromKey(pathname)));
  }, [pathname]);

  const parts = pathname.split('/').filter(Boolean).slice(1);
  const withTitle = (segment: string) => (/^\d+$/.test(segment) && title ? title : labelFor(segment));
  const ownTrail = parts.map((p, i) => ({ label: withTitle(p), href: `${rootPath}/${parts.slice(0, i + 1).join('/')}` }));

  // Came from a list or the dashboard that is not part of this page's own path? Show that as the step before the record.
  const isRecord = /\/\d+(\/|$)/.test(pathname);
  const cameFrom = from && from.startsWith(`${rootPath}/`) && !/\/\d+(\/|$)/.test(from) && !pathname.startsWith(`${from}/`) && from !== pathname ? from : null;
  let crumbs = ownTrail;
  if (isRecord && cameFrom) {
    const fromParts = cameFrom.split('/').filter(Boolean).slice(1);
    const recordIndex = parts.findIndex((p) => /^\d+$/.test(p));
    crumbs = [
      { label: labelFor(fromParts[fromParts.length - 1]), href: cameFrom },
      ...ownTrail.slice(recordIndex),
    ];
  }

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
      <Link href={homeHref} className="text-muted-foreground hover:text-foreground">{rootLabel}</Link>
      {crumbs.map((c, i) => (
        <span key={c.href} className="flex min-w-0 items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
          {i === crumbs.length - 1 ? (
            <span aria-current="page" className="truncate font-medium text-foreground">{c.label}</span>
          ) : (
            <Link href={c.href} className="truncate text-muted-foreground hover:text-foreground">{c.label}</Link>
          )}
        </span>
      ))}
    </nav>
  );
}
