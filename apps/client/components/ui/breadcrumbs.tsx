'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

const LABELS: Record<string, string> = { ui: 'UI', sku: 'SKU', new: 'New', commission: 'System commission' };

function labelFor(segment: string) {
  if (/^\d+$/.test(segment)) return `#${segment}`;
  return LABELS[segment] ?? segment.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/** Where the person is: "Admin / System commission / Balance changes", each earlier step a link. */
export function Breadcrumbs({ rootLabel, rootPath, homeHref }: { rootLabel: string; rootPath: string; homeHref: string }) {
  const pathname = usePathname();
  const parts = pathname.split('/').filter(Boolean).slice(1);
  const crumbs = parts.map((p, i) => ({ label: labelFor(p), href: `${rootPath}/${parts.slice(0, i + 1).join('/')}` }));
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
