'use client';

import { orderBirdText } from '@/components/products/bird-fields';
import { useState } from 'react';
import Link from 'next/link';
import { removeCartItem, setCartItemQuantity } from '@/lib/api/cart';
import { ApiError } from '@/lib/api/http';
import { useCart } from '@/lib/cart/cart-context';
import { money } from './product-card';
import type { Cart, CartLine, CartResult } from '@/types/cart';

const STATUS_TEXT: Record<Exclude<CartLine['status'], 'ok'>, string> = {
  unavailable: 'No longer available',
  out_of_stock: 'Out of stock',
  insufficient_stock: 'Not enough in stock',
};

function Line({
  cart,
  line,
  compact,
  onResult,
}: {
  cart: Cart;
  line: CartLine;
  compact: boolean;
  onResult: (r: CartResult) => void;
}) {
  const { changed } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = line.status !== 'ok';
  const max = Math.max(1, Math.min(99, line.availableQuantity || 99));

  async function run(action: () => Promise<CartResult>) {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      onResult(result);
      changed();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const offered = !!line.proposal;
  const stepper = offered ? (
    <span className="inline-flex h-7 items-center rounded-full border border-st-line bg-st-dove px-3 text-sm tabular-nums text-st-ink" title="The quantity is fixed by your offer">
      Qty {line.quantity}
    </span>
  ) : (
    <div className="inline-flex items-center rounded-full border border-st-line bg-white">
      <button
        type="button"
        aria-label={`Fewer ${line.product?.name ?? 'items'}`}
        disabled={busy || line.quantity <= 1 || line.status === 'unavailable'}
        onClick={() => run(() => setCartItemQuantity(cart.id, line.id, line.quantity - 1))}
        className="h-7 w-7 rounded-full text-base leading-none text-st-ink hover:bg-st-dove disabled:opacity-30"
      >
        −
      </button>
      <span className="min-w-6 text-center text-sm tabular-nums" aria-live="polite">{line.quantity}</span>
      <button
        type="button"
        aria-label={`More ${line.product?.name ?? 'items'}`}
        disabled={busy || line.quantity >= max || blocked}
        onClick={() => run(() => setCartItemQuantity(cart.id, line.id, line.quantity + 1))}
        className="h-7 w-7 rounded-full text-base leading-none text-st-ink hover:bg-st-dove disabled:opacity-30"
      >
        +
      </button>
    </div>
  );

  const image = line.sku?.imageUrl ?? line.product?.thumbnailUrl ?? null;
  return (
    <li className={`flex gap-3 ${compact ? 'py-2' : 'py-3'} ${busy ? 'opacity-60' : ''}`}>
      <div className={`${compact ? 'h-12 w-12' : 'h-16 w-16'} shrink-0 overflow-hidden rounded-lg bg-st-ink-2`}>
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {line.product ? (
              <Link href={`/products/${line.product.id}-${line.product.slug}`} className="line-clamp-2 text-sm font-medium text-st-ink hover:underline">
                {line.product.name}
              </Link>
            ) : (
              <span className="text-sm font-medium text-st-slate">Removed product</span>
            )}
            {line.sku?.label && <p className="text-xs text-st-slate">{line.sku.label}</p>}
            {orderBirdText(line.sku?.bird).length > 0 && <p className="text-xs text-st-slate">{orderBirdText(line.sku?.bird).join(' · ')}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold text-st-ink">{blocked ? '—' : money(line.linePayable)}</p>
            {!blocked && line.proposal?.applied && (
              <s className="block text-xs text-st-slate">{money(line.skuUnitPayable * line.quantity)}</s>
            )}
          </div>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          {stepper}
          {!blocked && <span className="text-xs text-st-slate">{money(line.unitPayable)} each</span>}
          {line.proposal?.applied && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Your offer</span>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => removeCartItem(cart.id, line.id))}
            className="text-xs text-st-slate underline-offset-2 hover:text-destructive hover:underline"
          >
            Remove
          </button>
        </div>

        {blocked && (
          <p role="alert" className="mt-1 text-xs font-medium text-destructive">
            {STATUS_TEXT[line.status as Exclude<CartLine['status'], 'ok'>]}
            {line.status === 'insufficient_stock' && ` (${line.availableQuantity} left)`}
            {line.status === 'insufficient_stock' && line.availableQuantity > 0 && (
              <button type="button" disabled={busy} onClick={() => run(() => setCartItemQuantity(cart.id, line.id, line.availableQuantity))} className="ml-2 underline">
                Set to {line.availableQuantity}
              </button>
            )}
          </p>
        )}
        {line.proposal && !blocked && (
          <p className="mt-1 text-xs text-st-slate">
            Bought at your accepted offer. To change the quantity, remove it and make a new offer.{' '}
            <Link href={`/proposals/${line.proposal.id}`} className="underline">See offer</Link>
          </p>
        )}
        {line.proposalNotice && (
          <p role="status" className={`mt-1 text-xs ${line.proposal ? 'text-amber-700' : 'text-st-slate'}`}>
            {line.proposalNotice}
          </p>
        )}
        {!blocked && line.priceChanged && (
          <p className="mt-1 text-xs text-amber-700">
            Price changed from {money(line.previousUnitPayable)} to {money(line.unitPayable)}.
          </p>
        )}
        {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
    </li>
  );
}

/** The lines of one cart, with quantity and remove controls. `onResult` gets the updated cart (or null once empty). */
export function CartLines({
  cart,
  compact = false,
  onResult,
}: {
  cart: Cart;
  compact?: boolean;
  onResult: (r: CartResult) => void;
}) {
  return (
    <ul className="divide-y divide-st-line">
      {cart.lines.map((line) => (
        <Line key={line.id} cart={cart} line={line} compact={compact} onResult={onResult} />
      ))}
    </ul>
  );
}

/** Takes this one cart to checkout; each seller's cart becomes its own order. */
export function CheckoutButton({ cart }: { cart: Cart }) {
  const ready = cart.canCheckout;
  return (
    <Link
      href={`/checkout/${cart.id}`}
      aria-disabled={!ready}
      className={`mt-3 flex w-full items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-colors ${ready ? 'bg-st-ink hover:bg-st-teal' : 'pointer-events-none bg-st-slate/50'}`}
    >
      Check out with {cart.seller.name}
    </Link>
  );
}

export function CartTotals({ cart }: { cart: Cart }) {
  const t = cart.totals;
  return (
    <dl className="space-y-1 text-sm">
      <div className="flex justify-between text-st-slate">
        <dt>Items</dt>
        <dd>{t.itemCount}</dd>
      </div>
      {t.savings > 0 && (
        <div className="flex justify-between text-st-slate">
          <dt>You save</dt>
          <dd className="text-st-teal">{money(t.savings)}</dd>
        </div>
      )}
      <div className="flex justify-between border-t border-st-line pt-1.5 text-base font-semibold text-st-ink">
        <dt>Subtotal</dt>
        <dd>{money(t.payableTotal)}</dd>
      </div>
      <p className="pt-0.5 text-xs text-st-slate">Delivery is added at checkout.</p>
    </dl>
  );
}
