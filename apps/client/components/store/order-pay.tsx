'use client';

import { useState } from 'react';
import { Check, Copy, Landmark, Smartphone } from 'lucide-react';
import { createPaymentClaim } from '@/lib/api/payment-claims';
import { ApiError } from '@/lib/api/http';
import { getUserToken } from '@/lib/auth/user-token';
import { loginUrlFor } from '@/lib/auth/next-path';
import { formatDateTime } from '@/lib/datetime';
import { CLAIM_STATUS_WORD } from '@/components/payments/claim-actions';
import type { OrderDetail } from '@/types/order';
import { money } from './product-card';

const card = 'rounded-xl border border-st-line bg-white p-4 sm:p-5';
const input = 'mt-1 w-full rounded-lg border border-st-line px-3 py-2 text-sm focus:border-st-teal focus:outline-none';
const ACCEPTED = ['confirmed', 'packed', 'shipped', 'delivered'];

function CopyNumber({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          // The browser blocked copying; the number is still on screen.
        }
      }}
      className="inline-flex items-center gap-1 rounded-full border border-st-line px-3 py-1 text-xs font-medium text-st-ink hover:border-st-ink"
    >
      {done ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />}
      {done ? 'Copied' : 'Copy number'}
    </button>
  );
}

/** The one "mark as paid" request a customer may send for a cash-on-delivery order, once the seller has accepted it. */
function MarkPaidForm({ order, onChanged }: { order: OrderDetail; onChanged: () => void }) {
  const [amount, setAmount] = useState(String(order.totals.balanceDue));
  const [txn, setTxn] = useState('');
  const [method, setMethod] = useState('');
  const [from, setFrom] = useState('');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!getUserToken()) {
      window.location.href = loginUrlFor(window.location.pathname + window.location.search);
      return;
    }
    const value = Number(amount);
    if (!amount || Number.isNaN(value) || value <= 0) return setError('Enter how much you paid.');
    if (!txn.trim()) return setError('Write the transaction ID.');
    if (!method.trim()) return setError('Say how you paid (bKash, Nagad, bank…).');
    if (files.length === 0) return setError('Attach a screenshot or a file that proves your payment.');
    setBusy(true);
    try {
      await createPaymentClaim(order.id, { amount: value, transactionId: txn.trim(), method: method.trim(), senderNumber: from.trim(), note: note.trim(), files });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not send your request.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-st-slate">Already paid for this order before it arrives? Send proof and the seller will check it. <span className="font-semibold text-st-ink">You can send only one request for an order.</span></p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-st-ink">Amount you paid (৳)<input inputMode="decimal" className={input} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        <label className="text-sm font-medium text-st-ink">Transaction ID<input className={input} maxLength={120} value={txn} onChange={(e) => setTxn(e.target.value)} placeholder="From your payment message" /></label>
        <label className="text-sm font-medium text-st-ink">How you paid<input className={input} maxLength={60} value={method} onChange={(e) => setMethod(e.target.value)} placeholder="bKash, Nagad, bank…" /></label>
        <label className="text-sm text-st-ink">Number you paid from (optional)<input className={input} maxLength={40} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
      </div>
      <label className="block text-sm text-st-ink">Note (optional)<input className={input} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <label className="block text-sm font-medium text-st-ink">Proof of payment (a screenshot or file)<input type="file" accept="image/*,.pdf" multiple className="mt-1 block w-full text-sm" onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))} /></label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={busy} className="rounded-full bg-st-ink px-6 py-2 text-sm font-semibold text-white hover:bg-st-teal disabled:opacity-50">{busy ? 'Sending…' : 'Send mark as paid request'}</button>
    </form>
  );
}

/**
 * Payment help on the order page.
 * - Cash on delivery: once the seller accepts the order, one "mark as paid" request. After that, only its state.
 * - Any other gateway: where to send the money (the seller's accounts).
 */
export function OrderPay({ order, onChanged }: { order: OrderDetail; onChanged: () => void }) {
  const accounts = order.payTo ?? [];
  const claim = (order.paymentClaims ?? [])[0];
  const cod = order.gateway.slug === 'cash-on-delivery';
  const due = order.totals.balanceDue > 0 && order.status !== 'cancelled';

  if (cod) {
    if (!claim && !(due && ACCEPTED.includes(order.status)) && !(due && order.status === 'pending')) return null;
    return (
      <section className={card} aria-labelledby="pay-title">
        <h2 id="pay-title" className="font-display mb-2 text-lg font-semibold text-st-ink">Mark as paid</h2>
        {claim ? (
          <div className="rounded-lg border border-st-line px-3 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-st-ink">{money(claim.amount)}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${claim.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : claim.status === 'pending' ? 'bg-amber-100 text-amber-900' : 'bg-st-dove text-st-slate'}`}>{CLAIM_STATUS_WORD[claim.status]}</span>
              <span className="text-xs text-st-slate">{formatDateTime(claim.createdAt)}</span>
            </div>
            {claim.transactionId && <p className="text-xs text-st-slate">Transaction {claim.transactionId}{claim.method ? ` · ${claim.method}` : ''}</p>}
            {claim.status === 'rejected' && <p className="mt-1 text-red-700">The seller did not accept your request{claim.decisionNote ? `: ${claim.decisionNote}` : ''}. You pay in cash when the order arrives. You cannot send another request for this order.</p>}
            {claim.status === 'pending' && <p className="mt-1 text-st-slate">The seller is checking your payment. You can send only one request for an order.</p>}
            {claim.status === 'confirmed' && <p className="mt-1 text-emerald-800">Your payment was accepted and the order is marked as paid.</p>}
          </div>
        ) : order.status === 'pending' ? (
          <p className="text-sm text-st-slate">You pay in cash when the order arrives. If you pay before that, you can send proof here once the seller accepts your order.</p>
        ) : (
          <MarkPaidForm order={order} onChanged={onChanged} />
        )}
      </section>
    );
  }

  if (!due) return null;
  return (
    <section className={card} aria-labelledby="pay-title">
      <h2 id="pay-title" className="font-display mb-1 text-lg font-semibold text-st-ink">Pay for this order</h2>
      <p className="text-sm text-st-slate">Send <span className="font-semibold text-st-ink">{money(order.totals.balanceDue)}</span> to {accounts.length > 0 ? 'one of these accounts' : 'the seller'}. Write your order number {order.orderNumber} in the reference if you can. The seller records your payment when it arrives.</p>
      {accounts.length > 0 ? (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {accounts.map((a) => (
            <li key={a.id} className="rounded-xl border border-st-line p-3">
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-st-dove">{a.kind === 'bank' ? <Landmark className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-st-ink">{a.provider}</p>
                  <p className="text-lg font-semibold tabular-nums text-st-ink">{a.accountNumber}</p>
                  {a.accountName && <p className="text-xs text-st-slate">{a.accountName}{a.branchName ? ` · ${a.branchName}` : ''}</p>}
                  {a.note && <p className="mt-1 text-xs text-st-slate">{a.note}</p>}
                </div>
              </div>
              <div className="mt-2"><CopyNumber value={a.accountNumber} /></div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-st-slate">The seller has not added payment details yet. Please contact them to ask where to pay.</p>
      )}
    </section>
  );
}
