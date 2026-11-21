'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Coins, CreditCard, LayoutDashboard, LayoutGrid, LogOut, Package, ReceiptText, UserRound } from 'lucide-react';
import { clearSellerToken } from '@/lib/auth/seller-token';

const ITEMS = [
  { key: 'dashboard', href: '/seller/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'products', href: '/seller/products', label: 'Products', icon: Package },
  { key: 'orders', href: '/seller/orders', label: 'Orders', icon: ReceiptText },
  { key: 'payments', href: '/seller/payments', label: 'Payments', icon: CreditCard },
  { key: 'commission', href: '/seller/commission', label: 'Commission', icon: Coins },
  { key: 'profile', href: '/seller/profile', label: 'Profile', icon: UserRound },
] as const;

/**
 * Left navigation of the seller portal. Pages using it add `pl-56` to their
 * outer wrapper so the content sits beside the fixed bar.
 */
export function SellerSidebar({ active }: { active: (typeof ITEMS)[number]['key'] }) {
  const router = useRouter();

  function logout() {
    clearSellerToken();
    router.replace('/seller/login');
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-56 flex-col bg-topbar text-topbar-foreground">
      <div className="flex h-16 items-center gap-2 px-5">
        <LayoutGrid className="h-5 w-5" />
        <span className="text-sm font-semibold tracking-wide">Pigeon Nest</span>
      </div>
      <p className="px-5 pb-1 text-xs font-semibold uppercase tracking-wider text-topbar-foreground/50">
        Seller
      </p>
      <nav className="space-y-1 px-3">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                item.key === active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-topbar-foreground/80 hover:bg-white/5 hover:text-topbar-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={logout}
        className="mx-3 mb-4 mt-auto flex items-center gap-3 rounded-md px-3 py-2 text-sm text-topbar-foreground/80 hover:bg-white/5 hover:text-topbar-foreground"
      >
        <LogOut className="h-4 w-4" />
        Log out
      </button>
    </aside>
  );
}
