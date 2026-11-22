'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CircleHelp, Coins, CreditCard, HandCoins, Heart, LayoutDashboard, Package, ReceiptText, RotateCcw, Star, UserRound } from 'lucide-react';
import { getSellerProposalSummary } from '@/lib/api/proposals';
import { listSellerReturns } from '@/lib/api/returns';

// Grouped like the admin navigation, each group under its own heading.
const GROUPS = [
  {
    label: 'Overview',
    items: [
      { key: 'dashboard', href: '/seller/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'dashboard-guide', href: '/seller/dashboard/guide', label: 'Dashboard guide', icon: CircleHelp },
    ],
  },
  { label: 'Catalog', items: [{ key: 'products', href: '/seller/products', label: 'Products', icon: Package }] },
  {
    label: 'Commerce',
    items: [
      { key: 'orders', href: '/seller/orders', label: 'Orders', icon: ReceiptText },
      { key: 'payments', href: '/seller/payments', label: 'Payments', icon: CreditCard },
      { key: 'returns', href: '/seller/returns', label: 'Returns', icon: RotateCcw },
      { key: 'offers', href: '/seller/offers', label: 'Offers', icon: HandCoins },
    ],
  },
  {
    label: 'Customers',
    items: [
      { key: 'wishlist', href: '/seller/wishlist', label: 'Wishlist', icon: Heart },
      { key: 'reviews', href: '/seller/reviews', label: 'Reviews', icon: Star },
    ],
  },
  { label: 'Commission', items: [{ key: 'commission', href: '/seller/commission', label: 'Commission', icon: Coins }] },
  { label: 'Account', items: [{ key: 'profile', href: '/seller/profile', label: 'Profile', icon: UserRound }] },
] as const;

type NavKey = (typeof GROUPS)[number]['items'][number]['key'];

/**
 * Left navigation of the seller portal. Pages using it add `pl-56` to their
 * outer wrapper so the content sits beside the fixed bar.
 */
export function SellerSidebar({ active }: { active: NavKey }) {
  const [awaiting, setAwaiting] = useState(0);
  const [returnsWaiting, setReturnsWaiting] = useState(0);
  useEffect(() => {
    let live = true;
    const load = () => getSellerProposalSummary().then((s) => live && setAwaiting(s.awaitingYou)).catch(() => undefined);
    load();
    // the offers page fires this after an answer so the badge does not wait for a reload
    window.addEventListener('seller-offers-changed', load);
    return () => {
      live = false;
      window.removeEventListener('seller-offers-changed', load);
    };
  }, []);

  useEffect(() => {
    let live = true;
    const load = () =>
      listSellerReturns({ status: 'return_requested', pageSize: 1 })
        .then((r) => live && setReturnsWaiting(r.total))
        .catch(() => undefined);
    load();
    // the returns pages fire this after a decision so the badge does not wait for a reload
    window.addEventListener('seller-returns-changed', load);
    return () => {
      live = false;
      window.removeEventListener('seller-returns-changed', load);
    };
  }, []);


  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-56 flex-col border-r border-white/5 bg-topbar text-topbar-foreground">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/5 px-5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brass font-[family-name:var(--font-display)] text-base font-bold text-topbar">P</span>
        <span className="leading-tight">
          <span className="block font-[family-name:var(--font-display)] text-sm font-semibold tracking-tight">Pigeon Nest</span>
          <span className="block text-[11px] text-topbar-foreground/50">Seller portal</span>
        </span>
      </div>
      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-topbar-foreground/40">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    aria-current={item.key === active ? 'page' : undefined}
                    className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                      item.key === active
                        ? 'bg-white/[0.08] font-medium text-white'
                        : 'text-topbar-foreground/70 hover:bg-white/5 hover:text-topbar-foreground'
                    }`}
                  >
                    {item.key === active && <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brass" />}
                    <Icon className={`h-4 w-4 ${item.key === active ? 'text-brass' : ''}`} />
                    {item.label}
                    {item.key === 'returns' && returnsWaiting > 0 && (
                      <span className="ml-auto rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white">{returnsWaiting}</span>
                    )}
                    {item.key === 'offers' && awaiting > 0 && (
                      <span className="ml-auto rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white">{awaiting}</span>
                    )}
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
