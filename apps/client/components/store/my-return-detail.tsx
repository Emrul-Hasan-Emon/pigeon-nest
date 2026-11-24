'use client';

import { orderBirdText } from '@/components/products/bird-fields';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { money, ReturnStateBadge, ReturnSteps } from './return-parts';
import { cancelMyReturn, getMyReturn } from '@/lib/api/returns';
import { ApiError, NotFoundApiError } from '@/lib/api/http';
import { loginUrlFor } from '@/lib/auth/next-path';
import { formatDateTime } from '@/lib/datetime';
import type { ReturnDetail } from '@/types/returns';

const card = 'rounded-xl border border-st-line bg-white p-4 sm:p-5';

export function MyReturnDetail({ id, justOpened }: { id: number; justOpened?: boolean }) {
  const [r, setR] = useState<ReturnDetail | null>(null);
  const [state, setState] = useState<'loading' | 'missing' | 'error' | 'signedOut' | 'ready'>('loading');
  const [cancelling, setCancelling] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setR(await getMyReturn(id));
      setState('ready');
    } catch (e) {
      setState(e instanceof NotFoundApiError ? 'missing' : e instanceof ApiError && e.status === 401 ? 'signedOut' : 'error');
    }
  }, [id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      setR(await cancelMyReturn(id, note.trim() || undefined));
      setCancelling(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'We could not cancel the request.');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') return <div className="store-skeleton h-64 rounded-xl bg-st-line" aria-busy="true" />;
  if (state === 'signedOut') {
    return (
      <div className="rounded-xl border border-st-line bg-white px-6 py-14 text-center">
        <p className="font-display text-lg font-semibold">Sign in to see this return</p>
        <Link href={loginUrlFor(`/returns/${id}`)} className="mt-4 inline-flex rounded-full bg-st-ink px-5 py-2 text-sm font-semibold text-white hover:bg-st-teal">Sign in</Link>
      </div>
    );
  }
  if (state !== 'ready' || !r) {
    return (
      <div className="rounded-xl border border-st-line bg-white px-6 py-14 text-center">
        <p className="font-display text-lg font-semibold">{state === 'missing' ? 'We can’t find that return' : 'We couldn’t load this return'}</p>
        <Link href="/returns" className="mt-4 inline-flex rounded-full bg-st-ink px-5 py-2 text-sm font-semibold text-white hover:bg-st-teal">Your returns</Link>
      </div>
    );
  }

  const first = r.history[0];
  return (
    <div className="space-y-4">
      {justOpened && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-display text-base font-semibold">Your return request is sent.</p>
          <p className="mt-0.5">The seller will accept or reject it. You can cancel it until they answer. It can only be requested once per order or item.</p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold text-st-ink sm:text-3xl">{r.returnNumber}</h1>
        <ReturnStateBadge status={r.status} />
      </div>
      <p className="-mt-2 text-sm text-st-slate">
        For order <Link className="underline" href={`/orders/${r.order.id}`}>{r.order.orderNumber}</Link> · sold by {r.seller.name} · requested {formatDateTime(r.createdAt)}
      </p>

      {r.actions.canCancel && (
        <section className={card}>
          {cancelling ? (
            <div className="space-y-2">
              <p className="text-sm text-st-ink">Cancel this request? You will not be able to ask for these items to be returned again.</p>
              <input className="w-full rounded-lg border border-st-line px-3 py-2 text-sm focus:border-st-teal focus:outline-none" maxLength={500} placeholder="Reason (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={cancel} className="rounded-full bg-destructive px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Cancelling…' : 'Yes, cancel request'}</button>
                <button type="button" onClick={() => setCancelling(false)} className="rounded-full border border-st-line px-4 py-1.5 text-sm text-st-ink hover:bg-st-dove">Keep it</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setCancelling(true)} className="text-sm text-st-slate underline-offset-2 hover:text-destructive hover:underline">Cancel this request</button>
          )}
        </section>
      )}

      <section className={card}>
        <h2 className="font-display mb-2 text-lg font-semibold text-st-ink">What you are returning</h2>
        <ul className="divide-y divide-st-line">
          {r.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 py-2 text-sm">
              <span className="text-st-ink">{i.productName}{i.skuLabel && <span className="block text-xs text-st-slate">{i.skuLabel}</span>}{orderBirdText(i.bird).length > 0 && <span className="block text-xs text-st-slate">{orderBirdText(i.bird).join(' · ')}</span>}</span>
              <span className="shrink-0 font-medium text-st-ink">{money(i.refundAmount)}</span>
            </li>
          ))}
        </ul>
        <dl className="ml-auto mt-2 max-w-xs space-y-1 border-t border-st-line pt-2 text-sm">
          <div className="flex justify-between text-st-slate"><dt>Items</dt><dd>{money(r.itemsAmount)}</dd></div>
          <div className="flex justify-between text-st-slate"><dt>Delivery</dt><dd>{r.scope === 'full_order' && r.includeDeliveryCharge ? money(r.deliveryAmount) : 'Not refunded'}</dd></div>
          <div className="flex justify-between text-base font-semibold text-st-ink"><dt>Refund</dt><dd>{money(r.refundAmount)}</dd></div>
        </dl>
        <p className="mt-3 text-sm text-st-slate">Why: <span className="whitespace-pre-wrap text-st-ink">{r.reason}</span></p>
        {first && first.attachments.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {first.attachments.map((a) => (
              <li key={a.id}><a href={a.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-st-line">
                {a.kind === 'image'
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={a.url} alt={a.fileName} className="h-16 w-16 object-cover" />
                  : <span className="flex h-16 w-16 items-center justify-center bg-st-dove px-1 text-center text-[10px] text-st-slate">{a.fileName}</span>}
              </a></li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className="font-display mb-3 text-lg font-semibold text-st-ink">Progress</h2>
        <ReturnSteps history={r.history} />
        {r.status === 'accepted' && <p className="mt-4 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900">The seller accepted. Send the items back as they asked, then wait for the refund.</p>}
        {r.status === 'rejected' && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">The seller rejected this request. Contact support if you think that is wrong.</p>}
        {r.status === 'returned' && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Done. {money(r.refundAmount)} was refunded.</p>}
      </section>
    </div>
  );
}
