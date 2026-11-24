'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bird, CircleHelp, Coins, CreditCard, HandCoins, Heart, House, LineChart, Package, ReceiptText, RotateCcw, Star, UserRound } from 'lucide-react';
import { getSellerProposalSummary } from '@/lib/api/proposals';
import { listSellerReturns } from '@/lib/api/returns';

// One flat list, always open: nothing to expand or hunt for. Each place has its own colour and icon so it is
// recognised by sight, and a thin line separates the daily work from people, money and the account.
const GROUPS = [
  { items: [{ key: 'dashboard', href: '/seller/dashboard', label: 'Home', icon: House, tile: 'bg-emerald-400/20 text-emerald-300' }] },
  {
    items: [
      { key: 'orders', href: '/seller/orders', label: 'Orders', icon: ReceiptText, tile: 'bg-amber-400/20 text-amber-300' },
      { key: 'products', href: '/seller/products', label: 'My products', icon: Package, tile: 'bg-sky-400/20 text-sky-300' },
      { key: 'payments', href: '/seller/payments', label: 'Payments', icon: CreditCard, tile: 'bg-teal-400/20 text-teal-300' },
      { key: 'returns', href: '/seller/returns', label: 'Returns', icon: RotateCcw, tile: 'bg-rose-400/20 text-rose-300' },
      { key: 'offers', href: '/seller/offers', label: 'Price offers', icon: HandCoins, tile: 'bg-violet-400/25 text-violet-300' },
    ],
  },
  {
    items: [
      { key: 'reviews', href: '/seller/reviews', label: 'Reviews', icon: Star, tile: 'bg-amber-400/20 text-amber-300' },
      { key: 'wishlist', href: '/seller/wishlist', label: 'Wishlist', icon: Heart, tile: 'bg-rose-400/20 text-rose-300' },
    ],
  },
  {
    items: [
      { key: 'reports', href: '/seller/reports', label: 'Reports', icon: LineChart, tile: 'bg-indigo-400/20 text-indigo-300' },
      { key: 'commission', href: '/seller/commission', label: 'System commission', icon: Coins, tile: 'bg-yellow-400/20 text-yellow-300' },
    ],
  },
  {
    items: [
      { key: 'profile', href: '/seller/profile', label: 'My profile', icon: UserRound, tile: 'bg-slate-400/25 text-slate-200' },
      { key: 'dashboard-guide', href: '/seller/dashboard/guide', label: 'Help', icon: CircleHelp, tile: 'bg-slate-400/25 text-slate-200' },
    ],
  },
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
    <aside className="fixed inset-y-0 left-0 z-20 flex w-56 flex-col bg-topbar text-topbar-foreground">
      <div className="flex h-16 shrink-0 items-center gap-3 px-5">
        <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sheen-a to-sheen-b text-white shadow-[0_4px_14px_-4px_rgb(122_91_208/0.7)]">
          <Bird className="h-5 w-5" strokeWidth={2} />
        </span>
        <span className="leading-tight">
          <span className="block font-[family-name:var(--font-serif)] text-lg font-semibold tracking-tight">Pigeon Nest</span>
          <span className="block text-xs text-topbar-foreground/55">Seller portal</span>
        </span>
      </div>
      <nav aria-label="Seller" className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-3">
        {GROUPS.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'mt-3 border-t border-white/10 pt-3' : ''}>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const on = item.key === active;
                const waiting = item.key === 'returns' ? returnsWaiting : item.key === 'offers' ? awaiting : 0;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    aria-current={on ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-base font-medium transition-colors ${
                      on ? 'bg-white text-topbar shadow-sm' : 'text-topbar-foreground/85 hover:bg-white/[0.07] hover:text-white'
                    }`}
                  >
                    <span aria-hidden="true" className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${on ? 'bg-topbar text-white' : item.tile}`}>
                      <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                    </span>
                    {item.label}
                    {waiting > 0 && (
                      <span aria-label={`${waiting} waiting`} className="ml-auto grid min-w-6 place-items-center rounded-full bg-amber-500 px-1.5 text-sm font-bold leading-6 text-white">{waiting}</span>
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
