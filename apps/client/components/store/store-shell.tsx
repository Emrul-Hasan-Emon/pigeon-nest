'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { getCategoryTree } from '@/lib/api/storefront';
import { useCart } from '@/lib/cart/cart-context';
import { getUserToken } from '@/lib/auth/user-token';
import type { CategoryNode } from '@/types/storefront';

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display text-xl font-semibold tracking-tight ${className}`}>
      Pigeon Nest
    </span>
  );
}

function SearchBox() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const q = query.trim();
    router.push(q ? `/products?search=${encodeURIComponent(q)}` : '/products');
  }

  return (
    <form onSubmit={submit} role="search" className="relative w-full">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search birds, supplies, sellers"
        aria-label="Search products"
        maxLength={200}
        className="h-9 w-full rounded-full border border-white/15 bg-white/10 pl-4 pr-20 text-sm text-white placeholder:text-white/50 focus:border-white/40 focus:bg-white/15 focus:outline-none"
      />
      <button
        type="submit"
        className="absolute right-1 top-1 h-7 rounded-full bg-white px-3.5 text-xs font-semibold text-st-ink transition-colors hover:bg-st-dove focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Search
      </button>
    </form>
  );
}

function CategoryBar() {
  const [roots, setRoots] = useState<CategoryNode[]>([]);

  useEffect(() => {
    getCategoryTree()
      .then(setRoots)
      .catch(() => setRoots([]));
  }, []);

  const link = 'shrink-0 rounded-full px-3 py-1 text-[13px] text-white/70 transition-colors hover:bg-white/10 hover:text-white';
  return (
    <nav aria-label="Categories" className="border-t border-white/10">
      <div className="store-scroll mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-1.5 sm:px-6">
        <Link href="/products" className={`${link} font-medium text-white`}>All products</Link>
        <Link href="/sellers" className={`${link} font-medium text-white`}>Sellers</Link>
        <span className="mx-1 h-4 w-px shrink-0 bg-white/20" aria-hidden />
        {roots.map((c) => (
          <Link key={c.id} href={`/categories/${c.slug}`} className={link}>
            {c.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function StoreHeader() {
  const [signedIn, setSignedIn] = useState(false);
  const { summary } = useCart();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSignedIn(!!getUserToken());
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-st-ink/95 text-white backdrop-blur">
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6 md:grid-cols-[auto_minmax(0,34rem)_auto] md:gap-x-8">
        <Link href="/" aria-label="Pigeon Nest home">
          <Wordmark />
        </Link>
        <div className="order-3 col-span-2 md:order-none md:col-span-1">
          <SearchBox />
        </div>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/cart"
            aria-label={`Your carts, ${summary.itemCount} ${summary.itemCount === 1 ? 'item' : 'items'}`}
            className="relative mr-1 flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ShoppingBag className="h-5 w-5" aria-hidden />
            {summary.itemCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-st-teal px-1 text-[10px] font-semibold text-white">
                {summary.itemCount > 99 ? '99+' : summary.itemCount}
              </span>
            )}
          </Link>
          <Link href="/orders" className="hidden rounded-full px-3 py-1.5 text-white/75 transition-colors hover:text-white md:block">
            Orders
          </Link>
          <Link href="/seller/register" className="hidden rounded-full px-3 py-1.5 text-white/75 transition-colors hover:text-white lg:block">
            Sell on Pigeon Nest
          </Link>
          {signedIn ? (
            <Link href="/user/profile" className="rounded-full bg-white px-4 py-1.5 font-medium text-st-ink transition-colors hover:bg-white/85">
              My account
            </Link>
          ) : (
            <>
              <Link href="/user/login" className="rounded-full px-3 py-1.5 text-white/75 transition-colors hover:text-white">
                Sign in
              </Link>
              <Link href="/user/register" className="hidden rounded-full bg-white px-4 py-1.5 font-medium text-st-ink transition-colors hover:bg-white/85 sm:block">
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
      <CategoryBar />
    </header>
  );
}

export function StoreFooter() {
  return (
    <footer className="mt-12 bg-st-ink text-white/70">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xs">
          <Wordmark className="text-white" />
          <p className="mt-2 text-sm leading-relaxed">
            Racing, fancy and utility pigeons from approved breeders, with everything the loft needs.
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-x-16 gap-y-3 text-sm">
          <li><Link href="/products" className="hover:text-white">All products</Link></li>
          <li><Link href="/sellers" className="hover:text-white">Sellers</Link></li>
          <li><Link href="/orders" className="hover:text-white">Your orders</Link></li>
          <li><Link href="/addresses" className="hover:text-white">Your addresses</Link></li>
          <li><Link href="/orders/track" className="hover:text-white">Track an order</Link></li>
          <li><Link href="/user/login" className="hover:text-white">Sign in</Link></li>
          <li><Link href="/seller/register" className="hover:text-white">Become a seller</Link></li>
        </ul>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-white/45">
        © {new Date().getFullYear()} Pigeon Nest
      </div>
    </footer>
  );
}
