'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getAdminCart } from '@/lib/api/cart';
import { NotFoundApiError } from '@/lib/api/http';
import { formatDateTime } from '@/lib/datetime';
import type { AdminCartDetail } from '@/types/cart';
import { LoadingBlock } from '@/components/ui/skeleton';
import { useBreadcrumbTitle } from '@/components/ui/breadcrumbs';

const STATUS: Record<string, string> = {
  ok: 'Available',
  unavailable: 'No longer available',
  out_of_stock: 'Out of stock',
  insufficient_stock: 'Not enough stock',
};

export default function AdminCartDetailPage() {
  const params = useParams<{ id: string }>();
  const [cart, setCart] = useState<AdminCartDetail | null>(null);
  useBreadcrumbTitle(cart ? `Cart #${cart.id}` : null);
  const [state, setState] = useState<'loading' | 'missing' | 'error' | 'ready'>('loading');

  useEffect(() => {
    let cancelled = false;
    getAdminCart(Number(params.id))
      .then((c) => {
        if (cancelled) return;
        setCart(c);
        setState('ready');
      })
      .catch((e) => !cancelled && setState(e instanceof NotFoundApiError ? 'missing' : 'error'));
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (state === 'loading') return <LoadingBlock />;
  if (state !== 'ready' || !cart) {
    return (
      <div className="py-10 text-center">
        <p className="text-foreground">{state === 'missing' ? 'That cart does not exist.' : 'Failed to load the cart.'}</p>
        <Link href="/admin/carts/active" className="mt-3 inline-block text-primary hover:underline">Back to carts</Link>
      </div>
    );
  }

  const back = cart.isActive ? '/admin/carts/active' : '/admin/carts/inactive';
  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <Link href={back} className="text-sm text-primary hover:underline">← {cart.isActive ? 'Active' : 'Inactive'} carts</Link>
        <h1 className="mt-1 text-2xl font-bold text-foreground">
          Cart #{cart.id}{' '}
          <span className={`ml-2 rounded-full px-2.5 py-0.5 align-middle text-xs font-medium ${cart.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
            {cart.isActive ? 'Active' : 'Inactive'}
          </span>
        </h1>
      </div>

      <div className="grid gap-4 rounded-xl border border-border bg-card p-5 text-sm shadow-sm md:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Customer</p>
          {cart.owner.user ? (
            <>
              <p className="font-medium text-foreground">{cart.owner.user.name}</p>
              <p className="text-muted-foreground">{cart.owner.user.phone}</p>
              {cart.owner.user.email && <p className="text-muted-foreground">{cart.owner.user.email}</p>}
            </>
          ) : (
            <>
              <p className="font-medium text-foreground">Guest</p>
              <p className="break-all text-xs text-muted-foreground">Session {cart.owner.sessionId}</p>
            </>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Seller</p>
          <p className="font-medium text-foreground">{cart.seller.name}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{cart.order ? 'Became order' : 'Order'}</p>
          <p className="font-medium text-foreground">{cart.order ? (cart.order.orderNumber ?? `#${cart.order.id}`) : 'Not ordered yet'}</p>
          {cart.order?.status && <p className="capitalize text-muted-foreground">{cart.order.status}</p>}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Created</p>
          <p className="text-foreground">{formatDateTime(cart.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Last changed</p>
          <p className="text-foreground">{formatDateTime(cart.updatedAt)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Prices shown</p>
          <p className="text-foreground">{cart.mode === 'live' ? 'Live, as a customer would see them now' : 'As they were when the cart was checked out'}</p>
        </div>
      </div>

      {cart.issues.length > 0 && (
        <ul role="status" className="list-inside list-disc rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {cart.issues.map((i) => <li key={i}>{i}</li>)}
        </ul>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted">
            <tr>
              {['Product', 'Variant', 'Qty', 'Unit price', 'Line total', ...(cart.mode === 'live' ? ['Status'] : [])].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {cart.lines.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">This cart has no items.</td></tr>}
            {cart.lines.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3 font-medium text-foreground">{l.product?.name ?? 'Removed product'}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.sku ? (l.sku.label || l.sku.code) : '—'}<span className="block text-xs">{l.sku?.code}</span></td>
                <td className="px-4 py-3 text-muted-foreground">{l.quantity}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {l.unitPayable}
                  {l.unitPrice !== l.unitPayable && <s className="ml-1 text-xs">{l.unitPrice}</s>}
                  {l.priceChanged && <span className="ml-1 text-xs text-amber-700">changed</span>}
                </td>
                <td className="px-4 py-3 font-medium text-foreground">{l.linePayable}</td>
                {cart.mode === 'live' && (
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${l.status === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-destructive/10 text-destructive'}`}>{STATUS[l.status ?? 'ok']}</span>
                    {l.status === 'insufficient_stock' && <span className="ml-1 text-xs text-muted-foreground">{l.availableQuantity} left</span>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ml-auto w-full max-w-xs space-y-1 text-sm">
        <div className="flex justify-between text-muted-foreground"><dt>Items</dt><dd>{cart.totals.itemCount}</dd></div>
        <div className="flex justify-between text-muted-foreground"><dt>List total</dt><dd>{cart.totals.listTotal}</dd></div>
        <div className="flex justify-between text-muted-foreground"><dt>Savings</dt><dd>{cart.totals.savings}</dd></div>
        <div className="flex justify-between border-t border-border pt-1 text-base font-semibold text-foreground"><dt>Payable</dt><dd>{cart.totals.payableTotal}</dd></div>
      </dl>
    </div>
  );
}
