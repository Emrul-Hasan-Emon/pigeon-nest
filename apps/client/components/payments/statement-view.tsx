'use client';

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { LoadingBlock } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/http';
import { getMyStatement, getSellerStatement } from '@/lib/api/payment-claims';
import { formatDate } from '@/lib/datetime';
import type { Statement } from '@/types/payment';
import { formatMoney } from '@/lib/money';

const monthInput = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthName = (m: string) => new Date(`${m}-01T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/**
 * A printable monthly statement for one seller: what was sold, the system commission, refunds, what was paid to the
 * marketplace, and what is owed at the start and end of the month. A seller sees their own; an admin picks a seller.
 */
export function StatementView({ role, sellerId }: { role: 'seller' | 'admin'; sellerId?: number }) {
  const [month, setMonth] = useState(monthInput());
  const [data, setData] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.add('print-doc');
    return () => document.body.classList.remove('print-doc');
  }, []);

  useEffect(() => {
    if (role === 'admin' && !sellerId) return;
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    (role === 'admin' ? getSellerStatement(sellerId as number, month) : getMyStatement(month))
      .then((r) => {
        if (!live) return;
        setData(r);
        setError(null);
      })
      .catch((e) => live && setError(e instanceof ApiError ? e.message : 'Could not load the statement.'))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [role, sellerId, month]);

  const field = 'rounded-md border border-input px-3 py-2';
  const s = data?.summary;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
        <label className="text-sm font-semibold">
          Month
          <input type="month" className={`${field} mt-1 block`} value={month} max={monthInput()} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        </label>
        <button type="button" onClick={() => window.print()} disabled={!data} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          <Printer aria-hidden="true" className="h-4 w-4" />
          Print
        </button>
      </div>
      {error && <p role="alert" className="mb-3 rounded-xl bg-destructive/10 px-4 py-3 text-destructive">{error}</p>}
      {loading && !data ? (
        <LoadingBlock />
      ) : (
        data &&
        s && (
          <article className="print-sheet rounded-lg border border-neutral-300 bg-white p-8 text-neutral-900 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-neutral-900 pb-4">
              <div>
                <p className="text-2xl font-bold">{data.seller.name}</p>
                <p className="text-sm text-neutral-600">Seller on Pigeon Nest{data.seller.phone ? ` · ${data.seller.phone}` : ''}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold uppercase tracking-wide">Statement</p>
                <p className="text-base font-semibold">{monthName(data.month)}</p>
                <p className="text-sm text-neutral-600">{formatDate(`${data.from}T12:00:00`)} to {formatDate(`${data.to}T12:00:00`)}</p>
              </div>
            </div>

            <section className="mt-5">
              <h2 className="text-sm font-bold uppercase text-neutral-600">The month in short</h2>
              <dl className="mt-2 grid gap-x-8 gap-y-1 text-base sm:grid-cols-2">
                {([
                  ['Paid orders', String(s.paidOrders)],
                  ['Sales', formatMoney(s.sales)],
                  ['System commission charged', formatMoney(s.systemCommission)],
                  ['System commission given back (returns)', formatMoney(s.systemCommissionGivenBack)],
                  ['Refunds to buyers', formatMoney(s.refunds)],
                  ['What you keep', formatMoney(s.youKeep)],
                ] as const).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-neutral-200 py-1"><dt>{k}</dt><dd className="font-semibold tabular-nums">{v}</dd></div>
                ))}
              </dl>
            </section>

            <section className="mt-5 rounded-lg border-2 border-neutral-900 p-4">
              <h2 className="text-sm font-bold uppercase text-neutral-600">What you owe the marketplace (system commission)</h2>
              <dl className="mt-2 space-y-1 text-base">
                <div className="flex justify-between"><dt>Owed at the start of the month</dt><dd className="tabular-nums">{formatMoney(s.owedAtStart)}</dd></div>
                <div className="flex justify-between"><dt>Added this month (net of returns)</dt><dd className="tabular-nums">{formatMoney(s.netSystemCommission)}</dd></div>
                <div className="flex justify-between"><dt>You paid the marketplace</dt><dd className="tabular-nums">−{formatMoney(s.paidToMarketplace)}</dd></div>
                <div className="flex justify-between border-t-2 border-neutral-900 pt-1 text-lg font-bold"><dt>Owed at the end of the month</dt><dd className="tabular-nums">{formatMoney(s.owedAtEnd)}</dd></div>
              </dl>
              {s.owedAtEnd < 0 && <p className="mt-1 text-sm text-neutral-600">A negative number means the marketplace owes you.</p>}
            </section>

            <section className="mt-6">
              <h2 className="text-sm font-bold uppercase text-neutral-600">Paid orders</h2>
              {data.orders.length === 0 ? (
                <p className="mt-1 text-sm text-neutral-600">No paid orders this month.</p>
              ) : (
                <table className="mt-2 w-full border-collapse text-sm">
                  <thead><tr className="border-y-2 border-neutral-900 text-left"><th className="py-1.5 pr-2">Order</th><th className="py-1.5 pr-2">Date</th><th className="py-1.5 pr-2 text-right">Amount</th><th className="py-1.5 pr-2 text-right">System commission</th><th className="py-1.5 text-right">You keep</th></tr></thead>
                  <tbody>
                    {data.orders.map((o) => (
                      <tr key={o.id} className="border-b border-neutral-300"><td className="py-1.5 pr-2">{o.orderNumber}</td><td className="py-1.5 pr-2">{formatDate(`${o.date}T12:00:00`)}</td><td className="py-1.5 pr-2 text-right tabular-nums">{formatMoney(o.amount)}</td><td className="py-1.5 pr-2 text-right tabular-nums">{formatMoney(o.systemCommission)}</td><td className="py-1.5 text-right tabular-nums">{formatMoney(o.youKeep)}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {data.refunds.length > 0 && (
              <section className="mt-6">
                <h2 className="text-sm font-bold uppercase text-neutral-600">Returns and refunds</h2>
                <table className="mt-2 w-full border-collapse text-sm">
                  <thead><tr className="border-y-2 border-neutral-900 text-left"><th className="py-1.5 pr-2">Return</th><th className="py-1.5 pr-2">Date</th><th className="py-1.5 pr-2 text-right">Refund</th><th className="py-1.5 text-right">System commission given back</th></tr></thead>
                  <tbody>
                    {data.refunds.map((r) => (
                      <tr key={r.id} className="border-b border-neutral-300"><td className="py-1.5 pr-2">{r.returnNumber}</td><td className="py-1.5 pr-2">{formatDate(`${r.date}T12:00:00`)}</td><td className="py-1.5 pr-2 text-right tabular-nums">{formatMoney(r.refund)}</td><td className="py-1.5 text-right tabular-nums">{formatMoney(r.systemCommissionGivenBack)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            <section className="mt-6">
              <h2 className="text-sm font-bold uppercase text-neutral-600">Payments you made to the marketplace</h2>
              {data.payments.length === 0 ? (
                <p className="mt-1 text-sm text-neutral-600">No payments this month.</p>
              ) : (
                <table className="mt-2 w-full border-collapse text-sm">
                  <thead><tr className="border-y-2 border-neutral-900 text-left"><th className="py-1.5 pr-2">Payment</th><th className="py-1.5 pr-2">Date</th><th className="py-1.5 pr-2">Note</th><th className="py-1.5 text-right">Amount</th></tr></thead>
                  <tbody>
                    {data.payments.map((p) => (
                      <tr key={p.id} className="border-b border-neutral-300"><td className="py-1.5 pr-2">#{p.id}</td><td className="py-1.5 pr-2">{formatDate(`${p.date}T12:00:00`)}</td><td className="py-1.5 pr-2">{p.note ?? ''}</td><td className="py-1.5 text-right tabular-nums">{formatMoney(p.amount)}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
            <p className="mt-8 border-t border-neutral-300 pt-3 text-center text-xs text-neutral-500">Made on {formatDate(data.generatedAt)}. Sales are paid orders that were not cancelled, counted on the day they were placed.</p>
          </article>
        )
      )}
    </div>
  );
}
