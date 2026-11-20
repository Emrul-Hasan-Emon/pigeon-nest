'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Breadcrumb, Container } from '@/components/store/page-parts';
import { CartLines, CartTotals, CheckoutButton } from '@/components/store/cart-lines';
import { SellerAvatar } from '@/components/store/seller-avatar';
import { clearCart, listMyCarts } from '@/lib/api/cart';
import { useCart } from '@/lib/cart/cart-context';
import type { Cart, CartResult } from '@/types/cart';

export default function CartPage() {
  const { version, changed } = useCart();
  const [carts, setCarts] = useState<Cart[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    document.title = 'Your carts | Pigeon Nest';
  }, []);

  useEffect(() => {
    let cancelled = false;
    listMyCarts()
      .then((r) => {
        if (cancelled) return;
        setCarts(r.carts);
        setFailed(false);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [version, attempt]);

  const update = useCallback((cartId: number, r: CartResult) => {
    setCarts((current) =>
      (current ?? []).flatMap((c) => (c.id !== cartId ? [c] : r.cart ? [r.cart] : [])),
    );
  }, []);

  async function empty(cart: Cart) {
    if (!window.confirm(`Remove everything from your cart with ${cart.seller.name}?`)) return;
    try {
      await clearCart(cart.id);
      setCarts((current) => (current ?? []).filter((c) => c.id !== cart.id));
      changed();
    } catch {
      setAttempt((a) => a + 1);
    }
  }

  return (
    <Container>
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Your carts' }]} />
      <h1 className="font-display mb-1 text-2xl font-semibold text-st-ink sm:text-3xl">Your carts</h1>
      <p className="mb-4 text-sm text-st-slate">One cart per seller, because each seller ships and is paid separately.</p>

      {failed ? (
        <div className="rounded-xl border border-st-line bg-white px-6 py-14 text-center">
          <p className="font-display text-lg font-semibold">We couldn&apos;t load your carts</p>
          <button type="button" onClick={() => setAttempt((a) => a + 1)} className="mt-4 rounded-full bg-st-ink px-5 py-2 text-sm font-semibold text-white hover:bg-st-teal">Try again</button>
        </div>
      ) : carts === null ? (
        <div className="store-skeleton space-y-3" aria-busy="true">
          <div className="h-40 rounded-xl bg-st-line" />
          <div className="h-40 rounded-xl bg-st-line" />
        </div>
      ) : carts.length === 0 ? (
        <div className="rounded-xl border border-st-line bg-white px-6 py-14 text-center">
          <p className="font-display text-lg font-semibold">Your carts are empty</p>
          <p className="mt-1 text-sm text-st-slate">Add something and it will wait here.</p>
          <Link href="/products" className="mt-4 inline-flex rounded-full bg-st-ink px-5 py-2 text-sm font-semibold text-white hover:bg-st-teal">Browse products</Link>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {carts.map((cart) => (
            <section key={cart.id} aria-label={`Cart with ${cart.seller.name}`} className="rounded-xl border border-st-line bg-white p-4">
              <header className="mb-1 flex items-center justify-between gap-3">
                <Link href={`/sellers/${cart.seller.id}`} className="flex min-w-0 items-center gap-2.5">
                  <SellerAvatar name={cart.seller.name} url={cart.seller.avatarUrl} size={36} />
                  <span className="truncate font-display font-semibold text-st-ink hover:underline">{cart.seller.name}</span>
                </Link>
                <button type="button" onClick={() => empty(cart)} className="shrink-0 text-xs text-st-slate underline-offset-2 hover:text-destructive hover:underline">Empty cart</button>
              </header>
              <CartLines cart={cart} onResult={(r) => update(cart.id, r)} />
              {cart.issues.length > 0 && (
                <ul role="status" className="mt-1 list-inside list-disc text-xs text-destructive">
                  {cart.issues.map((i) => <li key={i}>{i}</li>)}
                </ul>
              )}
              <div className="mt-2 border-t border-st-line pt-2">
                <CartTotals cart={cart} />
                <CheckoutButton cart={cart} />
              </div>
            </section>
          ))}
        </div>
      )}
    </Container>
  );
}
