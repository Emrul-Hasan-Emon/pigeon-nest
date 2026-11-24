'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { money, ReturnStateBadge } from './return-parts';
import { createMyReturn, getMyReturnEligibility } from '@/lib/api/returns';
import { ApiError } from '@/lib/api/http';
import { formatDate } from '@/lib/datetime';
import { RETURN_REASONS, type ReturnEligibility, type ReturnReasonCode, type ReturnScope } from '@/types/returns';
import type { OrderDetail } from '@/types/order';

const card = 'rounded-xl border border-st-line bg-white p-4 sm:p-5';
const input = 'w-full rounded-lg border border-st-line px-3 py-2 text-sm focus:border-st-teal focus:outline-none';

/** Returns on this order, and a form to ask for one (a whole order or some items). */
export function ReturnRequest({ order }: { order: OrderDetail }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [elig, setElig] = useState<ReturnEligibility | null>(null);
  const [scope, setScope] = useState<ReturnScope>('items');
  const [picked, setPicked] = useState<number[]>([]);
  const [reasonCode, setReasonCode] = useState<ReturnReasonCode>('not_as_described');
  const [reason, setReason] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidate = order.status === 'delivered' && order.paymentStatus === 'paid' && !order.isReturned;
  // The return window, known as soon as the page opens, so a late buyer is told at once and is not offered a button.
  const [window0, setWindow0] = useState<{ days: number; endsAt: string | null; ended: boolean } | null>(null);
  useEffect(() => {
    if (!candidate) return;
    let live = true;
    getMyReturnEligibility(order.id)
      .then((e) => live && setWindow0({ days: e.returnWindowDays, endsAt: e.windowEndsAt, ended: Boolean(e.windowEndsAt && new Date(e.windowEndsAt).getTime() < Date.now()) }))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [candidate, order.id]);
  const windowEnded = window0?.ended === true;
  if (!candidate && order.returns.length === 0) return null;

  async function begin() {
    setError(null);
    try {
      const e = await getMyReturnEligibility(order.id);
      setElig(e);
      setScope(e.fullOrder.allowed ? 'full_order' : 'items');
      setPicked([]);
      setOpen(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not check this order.');
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!elig) return;
    setError(null);
    if (reason.trim().length < 5) return setError('Tell the seller what is wrong (at least 5 characters).');
    if (scope === 'items' && picked.length === 0) return setError('Choose at least one item.');
    setBusy(true);
    try {
      const r = await createMyReturn({ orderId: order.id, scope, orderItemIds: scope === 'items' ? picked : undefined, reasonCode, reason: reason.trim(), files });
      router.push(`/returns/${r.id}?opened=1`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not send your request.');
      setBusy(false);
    }
  }

  const anyAllowed = elig ? elig.fullOrder.allowed || elig.items.some((i) => i.allowed) : true;
  const total = elig ? elig.items.filter((i) => picked.includes(i.orderItemId)).reduce((n, i) => n + i.refundAmount, 0) : 0;
  return (
    <section className={card}>
      <h2 className="font-display mb-2 text-lg font-semibold text-st-ink">Returns</h2>
      {order.returns.length > 0 && (
        <ul className="mb-3 divide-y divide-st-line text-sm">
          {order.returns.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <Link href={`/returns/${r.id}`} className="font-medium text-st-ink underline-offset-2 hover:underline">{r.returnNumber}</Link>
              <span className="text-st-slate">{r.scope === 'full_order' ? 'Whole order' : `${r.orderItemIds.length} item${r.orderItemIds.length === 1 ? '' : 's'}`} · {money(r.refundAmount)}</span>
              <ReturnStateBadge status={r.status} />
            </li>
          ))}
        </ul>
      )}
      {error && !open && <p role="alert" className="mb-2 text-sm text-destructive">{error}</p>}
      {!open && candidate && windowEnded && order.returns.length === 0 && (
        <p className="text-sm text-st-slate">
          The return window of {window0?.days} days ended on <span className="font-medium text-st-ink">{formatDate(window0?.endsAt)}</span>. You can no longer ask to return items from this order. If something is wrong, please contact the seller.
        </p>
      )}
      {!open && candidate && !windowEnded && (
        <div>
          {window0?.endsAt && <p className="mb-2 text-sm text-st-slate">You can ask for a return until <span className="font-medium text-st-ink">{formatDate(window0.endsAt)}</span> ({window0.days} days after delivery).</p>}
          <button type="button" onClick={begin} className="rounded-full border border-st-line px-4 py-1.5 text-sm font-medium text-st-ink hover:bg-st-dove">Return items from this order</button>
          <p className="mt-1 text-xs text-st-slate">You can ask once for each item, or for the whole order.</p>
        </div>
      )}
      {open && elig && (
        <form onSubmit={submit} className="space-y-3">
          {!anyAllowed ? (
            <p className="text-sm text-st-slate">{elig.fullOrder.reason ?? 'Nothing on this order can be returned.'}</p>
          ) : (
            <>
              {elig.windowEndsAt && <p className="text-xs text-st-slate">You can ask until {formatDate(elig.windowEndsAt)}.</p>}
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium text-st-ink">What do you want to return?</legend>
                <label className={`flex items-start gap-2 text-sm ${elig.fullOrder.allowed ? 'text-st-ink' : 'text-st-slate'}`}>
                  <input type="radio" name="scope" className="mt-1" checked={scope === 'full_order'} disabled={!elig.fullOrder.allowed} onChange={() => setScope('full_order')} />
                  <span>The whole order<span className="block text-xs text-st-slate">{elig.fullOrder.allowed ? `Refund up to ${money(elig.fullOrder.refundAmount)}. The seller decides whether delivery (${money(elig.fullOrder.deliveryCharge)}) is refunded too.` : elig.fullOrder.reason}</span></span>
                </label>
                <label className="flex items-start gap-2 text-sm text-st-ink">
                  <input type="radio" name="scope" className="mt-1" checked={scope === 'items'} onChange={() => setScope('items')} />
                  <span>Some items<span className="block text-xs text-st-slate">Delivery is not refunded when you return only some items.</span></span>
                </label>
              </fieldset>
              {scope === 'items' && (
                <ul className="space-y-1 rounded-lg border border-st-line p-3">
                  {elig.items.map((i) => (
                    <li key={i.orderItemId}>
                      <label className={`flex items-start gap-2 text-sm ${i.allowed ? 'text-st-ink' : 'text-st-slate'}`}>
                        <input type="checkbox" className="mt-1" disabled={!i.allowed} checked={picked.includes(i.orderItemId)} onChange={(e) => setPicked((c) => (e.target.checked ? [...c, i.orderItemId] : c.filter((x) => x !== i.orderItemId)))} />
                        <span>{i.productName} · {money(i.refundAmount)}{!i.allowed && <span className="block text-xs">{i.reason}</span>}</span>
                      </label>
                    </li>
                  ))}
                  {picked.length > 0 && <li className="pt-1 text-sm font-medium text-st-ink">Refund {money(total)}</li>}
                </ul>
              )}
              <label className="block text-sm font-medium text-st-ink">
                Why are you returning it?
                <select className={`${input} mt-1`} value={reasonCode} onChange={(e) => setReasonCode(e.target.value as ReturnReasonCode)}>
                  {RETURN_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </label>
              <label className="block text-sm text-st-ink">
                What is wrong?
                <textarea className={`${input} mt-1`} rows={3} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
              <label className="block text-sm text-st-ink">
                Photos (optional)
                <input type="file" multiple accept="image/*" className="mt-1 block w-full text-sm" onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 10))} />
              </label>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className="rounded-full bg-st-ink px-5 py-2 text-sm font-semibold text-white hover:bg-st-teal disabled:opacity-50">{busy ? 'Sending…' : 'Send return request'}</button>
                <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-st-line px-4 py-2 text-sm text-st-ink hover:bg-st-dove">Not now</button>
              </div>
            </>
          )}
        </form>
      )}
    </section>
  );
}
