'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { orderApi } from '@/lib/api/orders';
import { NotFoundApiError } from '@/lib/api/http';
import { formatDate } from '@/lib/datetime';
import { ageText } from '@/lib/bird';
import { LoadingBlock } from '@/components/ui/skeleton';
import { useBreadcrumbTitle } from '@/components/ui/breadcrumbs';
import { base, PAYMENT_STATUS_LABEL } from './ui';
import type { OrderDetail, OrderItemView, StaffRole } from '@/types/order';
import { formatMoney } from '@/lib/money';

export type PrintType = 'invoice' | 'slip';

const day = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** The facts a packer checks against the bird: ring, age, vaccine, breed, parents. */
function birdLines(item: OrderItemView): string[] {
  const b = item.bird;
  if (!b) return [];
  const parent = (label: string, p: { name: string | null; ringNumber: string | null } | null) => (p && (p.name || p.ringNumber) ? `${label}: ${[p.name, p.ringNumber ? `ring ${p.ringNumber}` : ''].filter(Boolean).join(', ')}` : '');
  return [
    b.ringNumber ? `Ring number: ${b.ringNumber}` : '',
    b.hatchDate ? `Hatched: ${day(b.hatchDate)} (${ageText(b.hatchDate)})` : '',
    b.vaccineName || b.vaccinatedOn ? `Vaccine: ${[b.vaccineName, b.vaccinatedOn ? day(b.vaccinatedOn) : ''].filter(Boolean).join(', ')}` : '',
    [b.breed, b.bloodline].filter(Boolean).length ? `Breed: ${[b.breed, b.bloodline].filter(Boolean).join(' · ')}` : '',
    parent('Father', b.sire),
    parent('Mother', b.dam),
  ].filter(Boolean);
}

/** A printable invoice or packing slip for one order. The screen chrome is hidden when printing. */
export function OrderPrintView({ role, id, initialType = 'invoice' }: { role: StaffRole; id: number; initialType?: PrintType }) {
  const api = useMemo(() => orderApi(role), [role]);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [state, setState] = useState<'loading' | 'missing' | 'error' | 'ready'>('loading');
  const [type, setType] = useState<PrintType>(initialType);
  useBreadcrumbTitle(order ? `Print ${order.orderNumber}` : null);

  useEffect(() => {
    api
      .detail(id)
      .then((o) => {
        setOrder(o);
        setState('ready');
      })
      .catch((e) => setState(e instanceof NotFoundApiError ? 'missing' : 'error'));
  }, [api, id]);

  // The print rules in globals.css hide the menus only while this class is on the page.
  useEffect(() => {
    document.body.classList.add('print-doc');
    return () => document.body.classList.remove('print-doc');
  }, []);

  const root = base(role);
  if (state === 'loading') return <LoadingBlock />;
  if (state !== 'ready' || !order) {
    return (
      <div className="py-10 text-center">
        <p className="text-foreground">{state === 'missing' ? 'That order does not exist.' : 'Failed to load the order.'}</p>
        <Link href={`${root}/orders`} className="mt-3 inline-block text-primary hover:underline">Back to orders</Link>
      </div>
    );
  }

  const invoice = type === 'invoice';
  const a = order.address;
  const toggle = (on: boolean) => `rounded-full border px-4 py-1.5 text-sm font-medium ${on ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-foreground hover:bg-muted'}`;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <Link href={`${root}/orders/${order.id}`} className="text-sm text-primary hover:underline">← Back to the order</Link>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button" className={toggle(invoice)} aria-pressed={invoice} onClick={() => setType('invoice')}>Invoice</button>
          <button type="button" className={toggle(!invoice)} aria-pressed={!invoice} onClick={() => setType('slip')}>Packing slip</button>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 font-semibold text-primary-foreground hover:opacity-90">
            <Printer aria-hidden="true" className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>

      <article className="print-sheet rounded-lg border border-neutral-300 bg-white p-8 text-neutral-900 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-neutral-900 pb-4">
          <div>
            <p className="text-2xl font-bold">{order.seller.name}</p>
            <p className="text-sm text-neutral-600">Sold through Pigeon Nest</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold uppercase tracking-wide">{invoice ? 'Invoice' : 'Packing slip'}</p>
            <p className="text-base font-semibold">{order.orderNumber}</p>
            <p className="text-sm text-neutral-600">Order date: {formatDate(order.createdAt)}</p>
          </div>
        </div>

        <section className="mt-5 grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="text-sm font-bold uppercase text-neutral-600">Deliver to</h2>
            <p className="mt-1 font-semibold">{a.recipientName}</p>
            <p>{a.line}</p>
            <p>{[a.city, a.state, a.postalCode].filter(Boolean).join(', ')}</p>
            <p>{a.countryName}</p>
            <p className="mt-1">Phone: {a.phone}</p>
            {a.email && <p>Email: {a.email}</p>}
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase text-neutral-600">Order</h2>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
              <dt className="font-semibold">Customer</dt><dd>{order.customer.name}</dd>
              <dt className="font-semibold">Delivery</dt><dd>{order.delivery.zoneName ?? order.delivery.type}{order.delivery.estimatedDays ? `, about ${order.delivery.estimatedDays} days` : ''}</dd>
              <dt className="font-semibold">Payment</dt><dd>{order.gateway.name}</dd>
              {invoice && <><dt className="font-semibold">Payment status</dt><dd>{PAYMENT_STATUS_LABEL[order.paymentStatus]}</dd></>}
            </dl>
          </div>
        </section>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y-2 border-neutral-900 text-left">
              {!invoice && <th className="w-10 py-2 pr-2">Packed</th>}
              <th className="py-2 pr-2">Item</th>
              <th className="w-16 py-2 pr-2 text-right">Qty</th>
              {invoice && <th className="w-28 py-2 pr-2 text-right">Unit price</th>}
              {invoice && <th className="w-28 py-2 text-right">Total</th>}
            </tr>
          </thead>
          <tbody>
            {order.items.map((i) => {
              const lines = birdLines(i);
              return (
                <tr key={i.id} className="border-b border-neutral-300 align-top">
                  {!invoice && <td className="py-3 pr-2"><span aria-hidden="true" className="inline-block h-5 w-5 rounded border-2 border-neutral-900" /></td>}
                  <td className="py-3 pr-2">
                    <p className="font-semibold">{i.productName}</p>
                    <p className="text-neutral-600">{i.sku.label}{i.sku.code ? ` · ${i.sku.code}` : ''}</p>
                    {lines.length > 0 && (
                      <ul className="mt-1 text-neutral-700">
                        {lines.map((l) => <li key={l}>{l}</li>)}
                      </ul>
                    )}
                  </td>
                  <td className="py-3 pr-2 text-right tabular-nums">{i.quantity}</td>
                  {invoice && <td className="py-3 pr-2 text-right tabular-nums">{formatMoney(i.unitPayable)}</td>}
                  {invoice && <td className="py-3 text-right tabular-nums">{formatMoney(i.lineTotal)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>

        {invoice ? (
          <dl className="ml-auto mt-4 w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><dt>Items</dt><dd className="tabular-nums">{formatMoney(order.totals.subtotal)}</dd></div>
            {order.totals.discountAmount > 0 && <div className="flex justify-between"><dt>Discount</dt><dd className="tabular-nums">−{formatMoney(order.totals.discountAmount)}</dd></div>}
            <div className="flex justify-between"><dt>Delivery</dt><dd className="tabular-nums">{formatMoney(order.totals.deliveryCharge)}</dd></div>
            <div className="flex justify-between border-t-2 border-neutral-900 pt-1 text-base font-bold"><dt>Total</dt><dd className="tabular-nums">{formatMoney(order.totals.payable)}</dd></div>
            <div className="flex justify-between"><dt>Paid</dt><dd className="tabular-nums">{formatMoney(order.totals.amountPaid)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>Still to pay</dt><dd className="tabular-nums">{formatMoney(order.totals.balanceDue)}</dd></div>
          </dl>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="text-sm font-bold uppercase text-neutral-600">Collect on delivery</h2>
              <p className="mt-1 text-lg font-bold">{order.totals.balanceDue > 0 ? `${formatMoney(order.totals.balanceDue)}` : 'Nothing: paid in full'}</p>
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase text-neutral-600">Packed by / date</h2>
              <p className="mt-6 border-b border-neutral-900" />
            </div>
          </div>
        )}

        {order.note && (
          <section className="mt-6">
            <h2 className="text-sm font-bold uppercase text-neutral-600">Note from the customer</h2>
            <p className="mt-1 whitespace-pre-wrap">{order.note}</p>
          </section>
        )}
        <p className="mt-8 border-t border-neutral-300 pt-3 text-center text-xs text-neutral-500">Thank you for buying from {order.seller.name}.</p>
      </article>
    </div>
  );
}
