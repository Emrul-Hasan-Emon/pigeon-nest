'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FilePicker, field, money, outlineButton, primaryButton, useApiError } from '@/components/orders/ui';
import { useToast } from '@/components/ui/toast';
import {
  adminSetReturnStatus,
  getAdminReturn,
  getSellerReturn,
  sellerAcceptReturn,
  sellerProcessReturn,
  sellerRejectReturn,
  sellerReturnMoney,
} from '@/lib/api/returns';
import { formatDateTime } from '@/lib/datetime';
import { NotFoundApiError } from '@/lib/api/http';
import type { ReturnDetail, ReturnStatus } from '@/types/returns';
import { OrderLink, RETURN_LABEL, ReturnBadge, ReturnItemsTable, ReturnTimeline, SCOPE_LABEL } from './parts';

const card = 'rounded-xl border border-border bg-card p-5 shadow-sm';

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

/** The seller's next step: accept or reject, then processing, then returning the money. */
function SellerActions({ r, onChanged }: { r: ReturnDetail; onChanged: (r: ReturnDetail) => void }) {
  const errorMessage = useApiError('seller');
  const { showToast } = useToast();
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [delivery, setDelivery] = useState(r.includeDeliveryCharge);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = r.actions.sellerNext;
  if (next.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing for you to do now.{r.status === 'returning_money' ? ' An admin confirms once the money is back.' : ''}</p>;
  }

  async function run(step: 'accept' | 'reject' | 'processing' | 'returning_money') {
    setError(null);
    if ((step === 'reject' || step === 'returning_money') && note.trim().length < 3) {
      return setError(step === 'reject' ? 'Tell the customer why you are rejecting.' : 'Describe how the money was returned.');
    }
    setBusy(true);
    try {
      const n = note.trim() || undefined;
      const out =
        step === 'accept' ? await sellerAcceptReturn(r.id, { note: n, includeDeliveryCharge: r.scope === 'full_order' ? delivery : undefined })
        : step === 'reject' ? await sellerRejectReturn(r.id, note.trim())
        : step === 'processing' ? await sellerProcessReturn(r.id, n)
        : await sellerReturnMoney(r.id, note.trim(), files);
      setNote('');
      setFiles([]);
      showToast('Return updated.', 'success');
      window.dispatchEvent(new Event('seller-returns-changed'));
      onChanged(out);
    } catch (e) {
      setError(errorMessage(e, 'We could not update this return.'));
    } finally {
      setBusy(false);
    }
  }

  const moneyStep = next.includes('returning_money');
  return (
    <div className="space-y-3">
      {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <label className="block text-sm text-foreground">
        {moneyStep ? 'How was the money returned?' : next.includes('reject') ? 'Note (required to reject)' : 'Note (optional)'}
        <textarea className={`${field} mt-1 w-full`} rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {next.includes('accept') && r.scope === 'full_order' && (
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input type="checkbox" className="mt-1" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} />
          <span>Refund the delivery charge too ({money(r.deliveryCharge)})<span className="block text-xs text-muted-foreground">Refund would be {money(r.itemsAmount + (delivery ? r.deliveryCharge : 0))}.</span></span>
        </label>
      )}
      {moneyStep && (
        <div>
          <p className="mb-1 text-sm text-foreground">Proof (optional)</p>
          <FilePicker files={files} onChange={setFiles} />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {next.includes('accept') && <button type="button" disabled={busy} onClick={() => run('accept')} className={primaryButton}>Accept return</button>}
        {next.includes('reject') && <button type="button" disabled={busy} onClick={() => run('reject')} className={outlineButton}>Reject</button>}
        {next.includes('processing') && <button type="button" disabled={busy} onClick={() => run('processing')} className={primaryButton}>Start processing</button>}
        {moneyStep && <button type="button" disabled={busy} onClick={() => run('returning_money')} className={primaryButton}>Money is being returned</button>}
      </div>
    </div>
  );
}

/** An admin can move a return to any status, with a note. */
function AdminActions({ r, onChanged }: { r: ReturnDetail; onChanged: (r: ReturnDetail) => void }) {
  const errorMessage = useApiError('admin');
  const { showToast } = useToast();
  const [status, setStatus] = useState<ReturnStatus | ''>('');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [delivery, setDelivery] = useState(r.includeDeliveryCharge);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changesDelivery = r.actions.canEditDelivery && delivery !== r.includeDeliveryCharge;
  const target = status || (changesDelivery ? r.status : '');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!target) return setError('Choose a status, or change the delivery option.');
    if (note.trim().length < 3) return setError('A note is required.');
    setBusy(true);
    try {
      const out = await adminSetReturnStatus(
        r.id,
        { status: target, note: note.trim(), includeDeliveryCharge: r.scope === 'full_order' && r.actions.canEditDelivery ? delivery : undefined },
        files,
      );
      setStatus('');
      setNote('');
      setFiles([]);
      showToast('Return updated.', 'success');
      onChanged(out);
    } catch (err) {
      setError(errorMessage(err, 'We could not update this return.'));
    } finally {
      setBusy(false);
    }
  }

  const enteringReturned = status === 'returned';
  const leavingReturned = r.status === 'returned' && status !== '' && status !== 'returned';
  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <label className="block text-sm text-foreground">
        Move to
        <select className={`${field} mt-1 w-full`} value={status} onChange={(e) => setStatus(e.target.value as ReturnStatus | '')}>
          <option value="">Keep {RETURN_LABEL[r.status].toLowerCase()}</option>
          {r.actions.adminTargets.map((s) => <option key={s} value={s}>{RETURN_LABEL[s]}</option>)}
        </select>
      </label>
      {enteringReturned && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Marking this returned takes {money(r.items.reduce((n, i) => n + (i.commissionAmount ?? 0), 0))} of commission off the seller and flags {r.scope === 'full_order' ? 'the items' : 'the item(s)'} as returned.
        </p>
      )}
      {leavingReturned && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">Moving this out of returned puts the commission back on the seller and clears the returned flags.</p>}
      {r.actions.canEditDelivery && (
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input type="checkbox" className="mt-1" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} />
          <span>Refund the delivery charge too ({money(r.deliveryCharge)})</span>
        </label>
      )}
      <label className="block text-sm text-foreground">
        Note (required)
        <textarea className={`${field} mt-1 w-full`} rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <FilePicker files={files} onChange={setFiles} />
      <button type="submit" disabled={busy} className={primaryButton}>{busy ? 'Saving…' : 'Update return'}</button>
    </form>
  );
}

export function ReturnDetailView({ role, id }: { role: 'admin' | 'seller'; id: number }) {
  const errorMessage = useApiError(role);
  const [r, setR] = useState<ReturnDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const load = useCallback(() => {
    (role === 'admin' ? getAdminReturn : getSellerReturn)(id)
      .then(setR)
      .catch((e) => (e instanceof NotFoundApiError ? setMissing(true) : setError(errorMessage(e, 'Failed to load this return.'))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, role]);
  useEffect(() => {
    load();
  }, [load]);

  if (missing) return <p className="py-10 text-center text-muted-foreground">Return not found. <Link className="text-primary hover:underline" href={`/${role}/returns`}>Back to returns</Link></p>;
  if (error) return <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>;
  if (!r) return <p className="py-10 text-center text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/${role}/returns`} className="text-sm text-primary hover:underline">← All returns</Link>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-bold text-foreground">{r.returnNumber} <ReturnBadge status={r.status} /></h1>
          <p className="text-sm text-muted-foreground">{SCOPE_LABEL[r.scope]} · opened {formatDateTime(r.createdAt)} by {r.requestedBy.type === 'user' ? 'the customer' : r.requestedBy.type}</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className={card}>
            <h2 className="mb-3 font-semibold text-foreground">Why</h2>
            <p className="whitespace-pre-wrap text-sm text-foreground">{r.reason}</p>
            {r.history[0]?.attachments.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {r.history[0].attachments.map((a) => (
                  <li key={a.id}><a href={a.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-border">
                    {a.kind === 'image'
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={a.url} alt={a.fileName} className="h-20 w-20 object-cover" />
                      : <span className="flex h-20 w-20 items-center justify-center bg-muted px-1 text-center text-[10px] text-muted-foreground">{a.fileName}</span>}
                  </a></li>
                ))}
              </ul>
            )}
          </section>
          <section className={card}>
            <h2 className="mb-3 font-semibold text-foreground">Items</h2>
            <ReturnItemsTable items={r.items} showCommission />
          </section>
          <section className={card}>
            <h2 className="mb-3 font-semibold text-foreground">History</h2>
            <ReturnTimeline history={r.history} />
          </section>
        </div>

        <div className="space-y-5">
          <section className={card}>
            <h2 className="mb-3 font-semibold text-foreground">Refund</h2>
            <dl className="grid grid-cols-2 gap-3">
              <Fact label="Items">{money(r.itemsAmount)}</Fact>
              <Fact label="Delivery">{r.scope === 'full_order' ? (r.includeDeliveryCharge ? money(r.deliveryAmount) : 'Not refunded') : 'Not refunded'}</Fact>
              <Fact label="Total refund"><strong>{money(r.refundAmount)}</strong></Fact>
              <Fact label="Commission back">{money(r.commissionAmount ?? 0)}</Fact>
            </dl>
            {r.returnedAt && <p className="mt-3 text-xs text-muted-foreground">Returned {formatDateTime(r.returnedAt)}</p>}
          </section>
          <section className={card}>
            <h2 className="mb-3 font-semibold text-foreground">Order and customer</h2>
            <dl className="space-y-3">
              <Fact label="Order"><OrderLink role={role} order={r.order} />{r.order.isReturned && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Fully returned</span>}</Fact>
              {role === 'admin' && <Fact label="Seller">{r.seller.name}</Fact>}
              <Fact label="Customer">{r.customer.name}{r.customer.isGuest && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Guest</span>}<span className="block text-xs text-muted-foreground">{r.customer.phone}{r.customer.email ? ` · ${r.customer.email}` : ''}</span></Fact>
            </dl>
          </section>
          <section className={card}>
            <h2 className="mb-3 font-semibold text-foreground">{role === 'admin' ? 'Admin actions' : 'Your next step'}</h2>
            {role === 'admin' ? <AdminActions key={r.history.length} r={r} onChanged={setR} /> : <SellerActions key={r.history.length} r={r} onChanged={setR} />}
          </section>
        </div>
      </div>
    </div>
  );
}
