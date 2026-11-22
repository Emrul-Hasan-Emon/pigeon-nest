'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CircleHelp, LayoutDashboard, Banknote, HandCoins, RotateCcw, ArrowRightLeft, Coins, Flag, Heart, Star, ClipboardCheck, ReceiptText, Wallet, ShoppingCart, ShoppingBag, CreditCard, Globe2, Settings2, History, Image as ImageIcon, LayoutTemplate, Layers, Rows3, Package, SlidersHorizontal, Store, Tags, Users } from 'lucide-react';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/dashboard/guide', label: 'Dashboard guide', icon: CircleHelp },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { href: '/admin/catalog/categories', label: 'Categories', icon: Tags },
      { href: '/admin/catalog/collections', label: 'Collections', icon: Layers },
      { href: '/admin/catalog/attributes', label: 'Attributes', icon: SlidersHorizontal },
      { href: '/admin/catalog/products', label: 'Products', icon: Package },
      { href: '/admin/catalog/products/status-history', label: 'Product history', icon: History },
    ],
  },
  {
    label: 'Content',
    items: [
      { href: '/admin/content/banners', label: 'Banners', icon: ImageIcon },
      { href: '/admin/content/homepage', label: 'Homepage', icon: LayoutTemplate },
      { href: '/admin/content/homepage-slots', label: 'Homepage slots', icon: Rows3 },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { href: '/admin/orders', label: 'Orders', icon: ReceiptText },
      { href: '/admin/payments', label: 'Payments', icon: Wallet },
      { href: '/admin/carts/active', label: 'Active carts', icon: ShoppingCart },
      { href: '/admin/carts/inactive', label: 'Inactive carts', icon: ShoppingBag },
      { href: '/admin/wishlist', label: 'Wishlists', icon: Heart },
      { href: '/admin/returns', label: 'Returns', icon: RotateCcw },
      { href: '/admin/proposals', label: 'Price proposals', icon: HandCoins },
      { href: '/admin/reviews', label: 'Reviews', icon: Star },
      { href: '/admin/reviews/reports', label: 'Review reports', icon: Flag },
    ],
  },
  {
    label: 'Commission',
    items: [
      { href: '/admin/commission', label: 'Balances', icon: Coins },
      { href: '/admin/commission/history', label: 'Commission ledger', icon: History },
      { href: '/admin/commission/changes', label: 'Balance changes', icon: ArrowRightLeft },
      { href: '/admin/commission/disbursements', label: 'Commission payments', icon: Banknote },
    ],
  },
  {
    label: 'Settings',
    items: [
      { href: '/admin/settings/payment-gateways', label: 'Payment gateways', icon: CreditCard },
      { href: '/admin/settings/shipping-zones', label: 'Shipping zones', icon: Globe2 },
      { href: '/admin/settings/general', label: 'General settings', icon: Settings2 },
    ],
  },
  {
    label: 'Sellers',
    items: [
      { href: '/admin/sellers', label: 'Sellers', icon: Store },
      { href: '/admin/sellers/requests', label: 'Pending requests', icon: ClipboardCheck },
      { href: '/admin/sellers/status-history', label: 'Status history', icon: History },
    ],
  },
  {
    label: 'Users',
    items: [
      { href: '/admin/users', label: 'Users', icon: Users },
      { href: '/admin/users/status-history', label: 'Status history', icon: History },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-56 flex-col border-r border-white/5 bg-topbar text-topbar-foreground">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/5 px-5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brass font-[family-name:var(--font-display)] text-base font-bold text-topbar">P</span>
        <span className="leading-tight">
          <span className="block font-[family-name:var(--font-display)] text-sm font-semibold tracking-tight">Pigeon Nest</span>
          <span className="block text-[11px] text-topbar-foreground/50">Admin console</span>
        </span>
      </div>
      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-topbar-foreground/40">
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
                    aria-current={active ? 'page' : undefined}
                    className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                      active
                        ? 'bg-white/[0.08] font-medium text-white'
                        : 'text-topbar-foreground/70 hover:bg-white/5 hover:text-topbar-foreground'
                    }`}
                  >
                    {active && <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brass" />}
                    <Icon className={`h-4 w-4 ${active ? 'text-brass' : ''}`} />
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
