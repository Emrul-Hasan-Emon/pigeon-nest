'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { listMyWishlist } from '@/lib/api/wishlist';
import { addToCart } from '@/lib/api/cart';
import { productHref } from '@/lib/api/storefront';
import { ApiError } from '@/lib/api/http';
import { loginUrlFor } from '@/lib/auth/next-path';
import { useCart } from '@/lib/cart/cart-context';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { useWishlist } from '@/lib/wishlist/wishlist-context';
import { money } from './product-card';
import type { WishlistItem } from '@/types/wishlist';

const PAGE_SIZE = 20;
const field = 'h-9 rounded-full border border-st-line bg-white px-3 text-sm focus:border-st-ink focus:outline-none';

type Availability = 'all' | 'buyable' | 'not';

function PriceNote({ item }: { item: WishlistItem }) {
  const change = item.priceChange;
  if (!change || change.direction === 'same') return null;
  const dropped = change.direction === 'dropped';
  return (
    <p className={`mt-0.5 text-xs font-medium ${dropped ? 'text-st-teal' : 'text-amber-700'}`}>
      {dropped ? 'Price dropped' : 'Price rose'} {money(change.amount)} since you saved it at {money(item.priceWhenSaved)}
    </p>
  );
}

function Row({ item, onRemoved }: { item: WishlistItem; onRemoved: (productId: number) => void }) {
  const { remove, busy } = useWishlist();
  const { changed } = useCart();
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const available = item.availability === 'available';
  const linkable = item.availability !== 'removed' && item.slug;

  async function handleAdd() {
    setAdding(true);
    setNote(null);
    try {
      // The wishlist stays as it is; only the customer removes things from it.
      await addToCart({ sellerProductId: item.productId });
      changed();
      setNote({ ok: true, text: 'Added to your cart.' });
    } catch (err) {
      setNote({ ok: false, text: err instanceof ApiError ? err.message : 'Could not add this to your cart.' });
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove() {
    if (await remove(item.productId)) onRemoved(item.productId);
  }

  const image = (
    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-st-dove sm:h-24 sm:w-24">
      {item.thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.thumbnailUrl} alt="" loading="lazy" className={`h-full w-full object-cover ${available ? '' : 'grayscale'}`} />
      )}
    </div>
  );
  const title = <h2 className="line-clamp-2 font-medium text-st-ink">{item.name ?? 'Removed product'}</h2>;

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-st-line bg-white p-3 sm:flex-row sm:items-center">
      <div className={`flex min-w-0 flex-1 items-center gap-3 ${available ? '' : 'opacity-60'}`}>
        {linkable ? <Link href={productHref({ id: item.productId, slug: item.slug! })}>{image}</Link> : image}
        <div className="min-w-0 flex-1">
          {linkable ? <Link href={productHref({ id: item.productId, slug: item.slug! })} className="hover:underline">{title}</Link> : title}
          {item.seller && <p className="truncate text-sm text-st-slate">{item.seller.name}</p>}
          {item.price !== null && (
            <p className="mt-0.5 font-semibold text-st-ink">{money(item.price)}</p>
          )}
          {available && <PriceNote item={item} />}
        </div>
      </div>
      <div className="flex flex-col items-start gap-1.5 sm:items-end">
        {!available && (
          <p className="rounded-full bg-st-dove px-2.5 py-0.5 text-xs font-medium text-st-slate" role="status">
            {item.reason}
          </p>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAdd}
            disabled={!available || adding}
            className="h-9 rounded-full bg-st-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-st-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-teal disabled:cursor-not-allowed disabled:opacity-40"
          >
            {adding ? 'Adding…' : 'Add to cart'}
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy(item.productId)}
            className="h-9 rounded-full border border-st-line px-4 text-sm font-medium text-st-ink transition-colors hover:border-st-ink disabled:opacity-50"
          >
            Remove
          </button>
        </div>
        {available && item.skuCount > 1 && linkable && (
          <Link href={productHref({ id: item.productId, slug: item.slug! })} className="text-xs text-st-slate underline">
            Choose another option
          </Link>
        )}
        {note && (
          <p role={note.ok ? 'status' : 'alert'} className={`text-xs ${note.ok ? 'text-st-teal' : 'text-destructive'}`}>
            {note.text}{' '}
            {note.ok && <Link href="/cart" className="underline">View cart</Link>}
          </p>
        )}
      </div>
    </li>
  );
}

export function WishlistList() {
  const { count, limit } = useWishlist();
  const [availability, setAvailability] = useState<Availability>('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const debouncedMin = useDebouncedValue(minPrice);
  const debouncedMax = useDebouncedValue(maxPrice);

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [sellers, setSellers] = useState<Map<number, string>>(new Map());
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const run = useRef(0);

  const filters = useCallback(() => {
    const min = debouncedMin.trim() === '' ? undefined : Number(debouncedMin);
    const max = debouncedMax.trim() === '' ? undefined : Number(debouncedMax);
    return {
      inStock: availability === 'all' ? undefined : availability === 'buyable',
      minPrice: min !== undefined && Number.isFinite(min) && min >= 0 ? min : undefined,
      maxPrice: max !== undefined && Number.isFinite(max) && max >= 0 ? max : undefined,
      sellerId: sellerId ? Number(sellerId) : undefined,
      search: debouncedSearch.trim() || undefined,
      limit: PAGE_SIZE,
    };
  }, [availability, debouncedMin, debouncedMax, sellerId, debouncedSearch]);

  const rememberSellers = (rows: WishlistItem[]) =>
    setSellers((cur) => {
      const next = new Map(cur);
      rows.forEach((r) => r.seller && next.set(r.seller.id, r.seller.name));
      return next;
    });

  useEffect(() => {
    const ticket = ++run.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    listMyWishlist(filters())
      .then((page) => {
        if (ticket !== run.current) return;
        setItems(page.results);
        setNextCursor(page.nextCursor);
        rememberSellers(page.results);
        setError(null);
      })
      .catch((err) => {
        if (ticket !== run.current) return;
        if (err instanceof ApiError && err.status === 401) setSignedOut(true);
        else setError(err instanceof ApiError ? err.message : 'Could not load your wishlist.');
      })
      .finally(() => ticket === run.current && setLoading(false));
  }, [filters]);

  async function loadMore() {
    if (nextCursor === null) return;
    setLoadingMore(true);
    try {
      const page = await listMyWishlist({ ...filters(), cursor: nextCursor });
      setItems((cur) => [...cur, ...page.results.filter((r) => !cur.some((c) => c.id === r.id))]);
      setNextCursor(page.nextCursor);
      rememberSellers(page.results);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load more.');
    } finally {
      setLoadingMore(false);
    }
  }

  const filtered = availability !== 'all' || minPrice || maxPrice || sellerId || search;

  if (signedOut) {
    return (
      <div className="rounded-xl border border-st-line bg-white px-6 py-14 text-center">
        <p className="font-display text-lg font-semibold">Sign in to see your wishlist</p>
        <p className="mt-1 text-sm text-st-slate">Save birds and supplies with the heart, and find them here.</p>
        <Link href={loginUrlFor('/wishlist')} className="mt-4 inline-flex rounded-full bg-st-ink px-5 py-2 text-sm font-semibold text-white hover:bg-st-teal">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="mb-3 text-sm text-st-slate">
        {count} of {limit} saved. Prices and stock here are live.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your wishlist"
          aria-label="Search your wishlist"
          maxLength={200}
          className={`${field} w-52`}
        />
        <select value={availability} onChange={(e) => setAvailability(e.target.value as Availability)} aria-label="Availability" className={field}>
          <option value="all">Everything</option>
          <option value="buyable">Can buy now</option>
          <option value="not">Not available</option>
        </select>
        <select value={sellerId} onChange={(e) => setSellerId(e.target.value)} aria-label="Seller" className={field}>
          <option value="">All sellers</option>
          {[...sellers].map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <input type="number" min={0} step="0.01" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="Min ৳" aria-label="Lowest price" className={`${field} w-24`} />
        <input type="number" min={0} step="0.01" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Max ৳" aria-label="Highest price" className={`${field} w-24`} />
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setAvailability('all');
              setMinPrice('');
              setMaxPrice('');
              setSellerId('');
              setSearch('');
            }}
            className="h-9 rounded-full px-3 text-sm text-st-slate underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {error && <p role="alert" className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="py-12 text-center text-st-slate">Loading your wishlist…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-st-line bg-white px-6 py-14 text-center">
          <p className="font-display text-lg font-semibold">{filtered ? 'Nothing matches these filters' : 'Your wishlist is empty'}</p>
          <p className="mt-1 text-sm text-st-slate">
            {filtered ? 'Change or clear the filters to see everything you saved.' : 'Tap the heart on any product to keep it here.'}
          </p>
          {!filtered && (
            <Link href="/products" className="mt-4 inline-flex rounded-full bg-st-ink px-5 py-2 text-sm font-semibold text-white hover:bg-st-teal">
              Browse products
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <Row key={item.id} item={item} onRemoved={(id) => setItems((cur) => cur.filter((r) => r.productId !== id))} />
          ))}
        </ul>
      )}

      {!loading && nextCursor !== null && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="h-10 rounded-full border border-st-line bg-white px-6 text-sm font-medium text-st-ink hover:border-st-ink disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </>
  );
}
