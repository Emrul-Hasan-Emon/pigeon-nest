'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardCheck, LayoutGrid, Layers, Package, SlidersHorizontal, Store, Tags } from 'lucide-react';

const NAV_GROUPS = [
  {
    label: 'Catalog',
    items: [
      { href: '/admin/catalog/categories', label: 'Categories', icon: Tags },
      { href: '/admin/catalog/collections', label: 'Collections', icon: Layers },
      { href: '/admin/catalog/attributes', label: 'Attributes', icon: SlidersHorizontal },
      { href: '/admin/catalog/products', label: 'Products', icon: Package },
    ],
  },
  {
    label: 'Sellers',
    items: [
      { href: '/admin/sellers', label: 'Sellers', icon: Store },
      { href: '/admin/sellers/requests', label: 'Pending requests', icon: ClipboardCheck },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-20 w-56 bg-topbar text-topbar-foreground">
      <div className="flex h-16 items-center gap-2 px-5">
        <LayoutGrid className="h-5 w-5" />
        <span className="text-sm font-semibold tracking-wide">Pigeon Nest</span>
      </div>
      <nav className="mt-2 space-y-4 px-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-topbar-foreground/50">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                // '/admin/sellers' also prefixes '/admin/sellers/requests': pick the longest match.
                const active =
                  pathname.startsWith(item.href) &&
                  !group.items.some(
                    (other) =>
                      other.href.length > item.href.length &&
                      pathname.startsWith(other.href),
                  );
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                      active
                        ? 'bg-accent text-accent-foreground'
                        : 'text-topbar-foreground/80 hover:bg-white/5 hover:text-topbar-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
