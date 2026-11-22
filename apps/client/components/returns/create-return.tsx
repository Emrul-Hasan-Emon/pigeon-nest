'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FilePicker, field, money, outlineButton, primaryButton } from '@/components/orders/ui';
import { adminCreateReturn, getAdminReturnEligibility } from '@/lib/api/returns';
import { ApiError, NotFoundApiError } from '@/lib/api/http';
import { formatDateTime } from '@/lib/datetime';
import type { ReturnEligibility, ReturnScope } from '@/types/returns';

const card = 'rounded-xl border border-border bg-card p-5 shadow-sm';

/** An admin opens a return for a customer's order: whole order or chosen items. */
export function AdminCreateReturn({ initialOrderId }: { initialOrderId?: number }) {
  const router = useRouter();
  const [orderInput, setOrderInput] = useState(initialOrderId ? String(initialOrderId) : '');
  const [elig, setElig] = useState<ReturnEligibility | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [scope, setScope] = useState<ReturnScope>('items');
  const [picked, setPicked] = useState<number[]>([]);
  const [delivery, setDelivery] = useState(true);
  const [reason, setReason] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(async (raw: string) => {
    const id = Number(raw);
    setElig(null);
    setLookupError(null);
    if (!Number.isInteger(id) || id < 1) return setLookupError('Enter the order id (the number in the order link).');
    try {
      const e = await getAdminReturnEligibility(id);
      setElig(e);
      setDelivery(e.fullOrder.includeDeliveryCharge);
      setScope(e.fullOrder.allowed ? 'full_order' : 'items');
      setPicked([]);
    } catch (err) {
      setLookupError(err instanceof NotFoundApiError ? 'No order with that id.' : err instanceof ApiError ? err.message : 'Failed to look the order up.');
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialOrderId) lookup(String(initialOrderId));
  }, [initialOrderId, lookup]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!elig) return;
    setError(null);
    if (reason.trim().length < 5) return setError('Give a reason (at least 5 characters).');
    if (scope === 'items' && picked.length === 0) return setError('Choose at least one item.');
    setBusy(true);
    try {
      const r = await adminCreateReturn({
        orderId: elig.orderId,
        scope,
        orderItemIds: scope === 'items' ? picked : undefined,
        reason: reason.trim(),
        includeDeliveryCharge: scope === 'full_order' ? delivery : undefined,
        files,
      });
      router.push(`/admin/returns/${r.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not open the return.');
      setBusy(false);
    }
  }

  const itemsTotal = elig ? elig.items.filter((i) => picked.includes(i.orderItemId)).reduce((n, i) => n + i.refundAmount, 0) : 0;
  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href="/admin/returns" className="text-sm text-primary hover:underline">← All returns</Link>
        <h1 className="mt-1 text-2xl font-bold text-foreground">Open a return</h1>
        <p className="text-sm text-muted-foreground">For a delivered, fully paid order. You can open another return for an item the customer already asked about, as long as it is not already returned or in an open return.</p>
      </div>

      <form className={`${card} flex flex-wrap items-end gap-3`} onSubmit={(e) => { e.preventDefault(); lookup(orderInput); }}>
        <label className="text-sm text-foreground">
          Order id
          <input className={`${field} mt-1 block w-40`} inputMode="numeric" value={orderInput} onChange={(e) => setOrderInput(e.target.value)} />
        </label>
        <button type="submit" className={outlineButton}>Look up</button>
        {lookupError && <p role="alert" className="w-full text-sm text-destructive">{lookupError}</p>}
      </form>

      {elig && (
        <form onSubmit={submit} className={`${card} space-y-4`}>
          <p className="text-sm text-foreground">Order <strong>{elig.orderNumber}</strong>{elig.windowEndsAt && <span className="text-muted-foreground"> · customer window {new Date(elig.windowEndsAt) < new Date() ? 'ended' : 'ends'} {formatDateTime(elig.windowEndsAt)} (you are not held to it)</span>}</p>
          {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-foreground">What comes back</legend>
            <label className={`flex items-start gap-2 text-sm ${elig.fullOrder.allowed ? 'text-foreground' : 'text-muted-foreground'}`}>
              <input type="radio" className="mt-1" name="scope" checked={scope === 'full_order'} disabled={!elig.fullOrder.allowed} onChange={() => setScope('full_order')} />
              <span>The whole order<span className="block text-xs text-muted-foreground">{elig.fullOrder.allowed ? `Items ${money(elig.fullOrder.itemsAmount)}, delivery ${money(elig.fullOrder.deliveryCharge)}` : elig.fullOrder.reason}</span></span>
            </label>
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input type="radio" className="mt-1" name="scope" checked={scope === 'items'} onChange={() => setScope('items')} />
              <span>Chosen items<span className="block text-xs text-muted-foreground">The delivery charge is never refunded on an item return.</span></span>
            </label>
          </fieldset>

          {scope === 'items' && (
            <ul className="space-y-1 rounded-md border border-border p-3">
              {elig.items.map((i) => (
                <li key={i.orderItemId}>
                  <label className={`flex items-start gap-2 text-sm ${i.allowed ? 'text-foreground' : 'text-muted-foreground'}`}>
                    <input type="checkbox" className="mt-1" disabled={!i.allowed} checked={picked.includes(i.orderItemId)} onChange={(e) => setPicked((c) => (e.target.checked ? [...c, i.orderItemId] : c.filter((x) => x !== i.orderItemId)))} />
                    <span>{i.productName} · {money(i.refundAmount)}{!i.allowed && <span className="block text-xs">{i.reason}</span>}</span>
                  </label>
                </li>
              ))}
              {picked.length > 0 && <li className="pt-1 text-sm font-medium text-foreground">Refund {money(itemsTotal)}</li>}
            </ul>
          )}
          {scope === 'full_order' && (
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input type="checkbox" className="mt-1" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} />
              <span>Refund the delivery charge too ({money(elig.fullOrder.deliveryCharge)})<span className="block text-xs text-muted-foreground">Refund {money(elig.fullOrder.itemsAmount + (delivery ? elig.fullOrder.deliveryCharge : 0))}. The seller can change this when accepting.</span></span>
            </label>
          )}

          <label className="block text-sm text-foreground">
            Reason
            <textarea className={`${field} mt-1 w-full`} rows={3} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <FilePicker files={files} onChange={setFiles} />
          <button type="submit" disabled={busy} className={primaryButton}>{busy ? 'Opening…' : 'Open return'}</button>
        </form>
      )}
    </div>
  );
}
