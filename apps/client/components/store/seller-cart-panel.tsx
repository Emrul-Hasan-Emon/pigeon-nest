'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getSellerCart } from '@/lib/api/cart';
import { useCart } from '@/lib/cart/cart-context';
import { CartLines, CartTotals, CheckoutButton } from './cart-lines';
import type { Cart, CartResult } from '@/types/cart';

/** "Your cart with {seller}": this seller's cart only, with a link to all carts. */
export function SellerCartPanel({ sellerId, sellerName }: { sellerId: number; sellerName: string }) {
  const { version, summary } = useCart();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSellerCart(sellerId)
      .then((r) => {
        if (cancelled) return;
        setCart(r.cart);
        setFailed(false);
        setLoaded(true);
      })
      .catch(() => !cancelled && (setFailed(true), setLoaded(true)));
    return () => {
      cancelled = true;
    };
  }, [sellerId, version]);

  const onResult = useCallback((r: CartResult) => setCart(r.cart), []);
  const otherCarts = Math.max(0, summary.cartCount - (cart ? 1 : 0));

  return (
    <section aria-label={`Your cart with ${sellerName}`} className="rounded-xl border border-st-line bg-white p-4">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-st-ink">Your cart with {sellerName}</h2>
        <Link href="/cart" className="shrink-0 text-xs text-st-slate underline-offset-2 hover:text-st-ink hover:underline">
          All carts{summary.cartCount > 0 ? ` (${summary.cartCount})` : ''}
        </Link>
      </div>

      {!loaded ? (
        <div className="store-skeleton h-16 rounded-lg bg-st-line" aria-busy="true" />
      ) : failed ? (
        <p className="text-sm text-st-slate">We couldn&apos;t load this cart.</p>
      ) : !cart ? (
        <p className="text-sm text-st-slate">
          Nothing from this seller yet.
          {otherCarts > 0 && <> You have {otherCarts} other {otherCarts === 1 ? 'cart' : 'carts'}.</>}
        </p>
      ) : (
        <>
          <CartLines cart={cart} compact onResult={onResult} />
          {cart.issues.length > 0 && (
            <ul role="status" className="mt-1 list-inside list-disc text-xs text-destructive">
              {cart.issues.map((i) => <li key={i}>{i}</li>)}
            </ul>
          )}
          <div className="mt-2 border-t border-st-line pt-2">
            <CartTotals cart={cart} />
            <CheckoutButton cart={cart} />
          </div>
        </>
      )}
    </section>
  );
}
