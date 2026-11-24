'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bird, ChevronDown, CircleHelp, FileText, LayoutDashboard, LineChart, ListChecks, MailCheck, MessageCircleQuestion, Banknote, HandCoins, RotateCcw, ArrowRightLeft, Coins, Flag, Heart, Star, ClipboardCheck, ReceiptText, Wallet, ShoppingCart, ShoppingBag, CreditCard, Globe2, Settings2, History, Image as ImageIcon, LayoutTemplate, Layers, Rows3, Package, SlidersHorizontal, Store, Tags, Users } from 'lucide-react';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/dashboard/guide', label: 'Dashboard guide', icon: CircleHelp },
      { href: '/admin/reports', label: 'Reports', icon: LineChart },
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
      { href: '/admin/payment-claims', label: 'Mark-paid requests', icon: MailCheck },
      { href: '/admin/carts/active', label: 'Active carts', icon: ShoppingCart },
      { href: '/admin/carts/inactive', label: 'Inactive carts', icon: ShoppingBag },
      { href: '/admin/wishlist', label: 'Wishlists', icon: Heart },
      { href: '/admin/returns', label: 'Returns', icon: RotateCcw },
      { href: '/admin/refunds', label: 'Refunds', icon: Banknote },
      { href: '/admin/proposals', label: 'Price proposals', icon: HandCoins },
      { href: '/admin/questions', label: 'Buyer questions', icon: MessageCircleQuestion },
      { href: '/admin/reviews', label: 'Reviews', icon: Star },
      { href: '/admin/reviews/reports', label: 'Review reports', icon: Flag },
    ],
  },
  {
    label: 'System commission',
    items: [
      { href: '/admin/commission', label: 'Balances', icon: Coins },
      { href: '/admin/commission/history', label: 'System commission ledger', icon: History },
      { href: '/admin/commission/changes', label: 'Balance changes', icon: ArrowRightLeft },
      { href: '/admin/commission/disbursements', label: 'System commission payments', icon: Banknote },
      { href: '/admin/statements', label: 'Seller statements', icon: FileText },
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
      { href: '/admin/sellers/onboarding', label: 'Seller setup', icon: ListChecks },
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

/** '/admin/sellers' also prefixes '/admin/sellers/requests': the longest matching link in the group wins. */
function activeHref(pathname: string, items: { href: string }[]) {
  const hits = items.filter((i) => pathname.startsWith(i.href));
  return hits.sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export function AdminSidebar() {
  const pathname = usePathname();
  // Only the group you are in starts open, so 31 links do not all compete at once. A group you toggled stays as you left it.
  const current = NAV_GROUPS.find((g) => activeHref(pathname, g.items))?.label;
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const toggle = (label: string, isOpen: boolean) => setToggled((t) => ({ ...t, [label]: !isOpen }));

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col bg-topbar text-topbar-foreground">
      <div className="flex h-16 shrink-0 items-center gap-3 px-5">
        <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-sheen-a to-sheen-b text-white shadow-[0_4px_14px_-4px_rgb(122_91_208/0.7)]">
          <Bird className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>
        <span className="leading-tight">
          <span className="block font-[family-name:var(--font-serif)] text-[17px] font-semibold tracking-tight">Pigeon Nest</span>
          <span className="block text-[11px] text-topbar-foreground/45">Admin console</span>
        </span>
      </div>
      <nav aria-label="Admin" className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-6 pt-2">
        {NAV_GROUPS.map((group) => {
          const isOpen = toggled[group.label] ?? group.label === current;
          const here = activeHref(pathname, group.items);
          const panelId = `nav-${group.label.toLowerCase()}`;
          return (
            <div key={group.label}>
              <button
                type="button"
                onClick={() => toggle(group.label, isOpen)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-[13px] font-medium transition-colors hover:text-white ${here ? 'text-white' : 'text-topbar-foreground/55'}`}
              >
                {group.label}
                <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
              </button>
              <div id={panelId} className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden" inert={!isOpen}>
                  <div className="space-y-px pb-2">
                    {group.items.map((item) => {
                      const active = item.href === here;
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          className={`relative flex items-center gap-3 rounded-md px-3 py-[7px] text-[13.5px] transition-colors ${
                            active ? 'bg-white/[0.09] font-medium text-white' : 'text-topbar-foreground/70 hover:bg-white/[0.05] hover:text-white'
                          }`}
                        >
                          {active && <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-signal" />}
                          <Icon aria-hidden="true" className={`h-4 w-4 ${active ? 'text-signal' : 'text-topbar-foreground/50'}`} />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
