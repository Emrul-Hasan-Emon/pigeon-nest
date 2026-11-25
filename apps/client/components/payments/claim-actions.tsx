'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api/http';
import { confirmPaymentClaim, rejectPaymentClaim } from '@/lib/api/payment-claims';
import type { PaymentClaim } from '@/types/payment';
import { formatMoney } from '@/lib/money';

const field = 'mt-1 w-full rounded-md border border-input px-3 py-2';

/** Check one "I have paid" message: confirm it (the money is recorded on the order) or reject it with a reason. */
export function ClaimDecision({ role, claim, onDone, balance }: { role: 'admin' | 'seller'; claim: PaymentClaim; onDone: () => void; balance?: number }) {
  const { showToast } = useToast();
  const [mode, setMode] = useState<'confirm' | 'reject' | null>(null);
  const [amount, setAmount] = useState(String(claim.amount));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'confirm') {
        const value = Number(amount);
        if (!amount || Number.isNaN(value) || value <= 0) throw new ApiError(400, 'Enter the amount you received.');
        await confirmPaymentClaim(role, claim.id, { amount: value, note: note.trim() || undefined });
        showToast('Accepted. The order is marked as paid.', 'success');
      } else {
        if (note.trim().length < 3) throw new ApiError(400, 'Tell the buyer why, in a few words.');
        await rejectPaymentClaim(role, claim.id, note.trim());
        showToast('The buyer will see your reason. They cannot send another request for this order.', 'success');
      }
      setMode(null);
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { setError(null); setMode('confirm'); }} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">Accept: mark as paid</button>
        <button type="button" onClick={() => { setError(null); setNote(''); setMode('reject'); }} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Reject</button>
      </div>
      {mode && (
        <Modal title={mode === 'confirm' ? 'Accept and mark as paid' : 'Reject this request'} onClose={() => setMode(null)}>
          <div className="space-y-3 p-5">
            {mode === 'confirm' ? (
              <>
                <p className="text-sm text-muted-foreground">Check the proof first. Accepting marks the order as paid and records the money on it{balance !== undefined ? ` (still to pay: ${formatMoney(balance)})` : ''}.</p>
                <label className="block text-sm">Amount you received (USD)<input inputMode="decimal" className={field} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
                <label className="block text-sm">Note (optional)<input className={field} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></label>
              </>
            ) : (
              <label className="block text-sm">Why? The buyer will read this. They cannot send another request for this order.<input className={field} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: I cannot find this transaction ID" /></label>
            )}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setMode(null)} className="rounded-lg border border-border px-5 py-2.5 font-medium hover:bg-muted">Cancel</button>
              <button type="button" disabled={busy} onClick={run} className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">{busy ? 'Saving…' : mode === 'confirm' ? 'Mark as paid' : 'Reject'}</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export const CLAIM_STATUS_WORD: Record<PaymentClaim['status'], string> = {
  pending: 'Waiting to be checked',
  confirmed: 'Confirmed',
  rejected: 'Not accepted',
  cancelled: 'Taken back',
};

export function ClaimBadge({ status }: { status: PaymentClaim['status'] }) {
  const tone = status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : status === 'pending' ? 'bg-amber-100 text-amber-900' : 'bg-muted text-muted-foreground';
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{CLAIM_STATUS_WORD[status]}</span>;
}

/** The facts a claim gives, to compare with the account statement. */
export function ClaimFacts({ claim }: { claim: PaymentClaim }) {
  const items = [
    ['Amount', `${formatMoney(claim.amount)}`],
    claim.transactionId ? ['Transaction ID', claim.transactionId] : null,
    claim.method ? ['Paid with', claim.method] : null,
    claim.senderNumber ? ['Paid from', claim.senderNumber] : null,
    claim.paidOn ? ['Paid on', claim.paidOn] : null,
  ].filter(Boolean) as [string, string][];
  return (
    <div>
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {items.map(([k, v]) => (
          <div key={k} className="flex gap-2"><dt className="font-semibold">{k}:</dt><dd className="tabular-nums">{v}</dd></div>
        ))}
      </dl>
      {claim.note && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">“{claim.note}”</p>}
      {claim.attachments.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {claim.attachments.map((a) => (
            <li key={a.fileUrl}>
              <a href={a.fileUrl} target="_blank" rel="noreferrer" className="inline-block rounded-lg border border-border px-3 py-1 text-sm font-medium text-primary hover:bg-muted">{a.kind === 'image' ? 'View screenshot' : a.fileName}</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
