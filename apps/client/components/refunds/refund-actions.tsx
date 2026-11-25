'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api/http';
import { addOrderRefundRecord, addReturnMoneyRecord, changeRefundStatus } from '@/lib/api/refunds';
import { REFUND_STATUS_WORD, type RefundStatus } from '@/types/refund';
import { formatMoney } from '@/lib/money';

const field = 'mt-1 w-full rounded-md border border-input px-3 py-2';

type Target = { kind: 'change'; id: number; from: RefundStatus } | { kind: 'addOrder'; orderId: number } | { kind: 'addReturn'; returnId: number };

/**
 * The window for moving a refund on, or (admin) adding another record. "Refunded" asks for the amount (exactly what the
 * buyer paid), a note, and a proof file; the server refuses any other amount.
 */
function RefundModal({ role, target, expected, initial, onClose, onDone }: { role: 'admin' | 'seller'; target: Target; expected: number; initial: RefundStatus; onClose: () => void; onDone: () => void }) {
  const { showToast } = useToast();
  const [status, setStatus] = useState<RefundStatus>(initial);
  const [amount, setAmount] = useState(String(expected));
  const [note, setNote] = useState('');
  const [txn, setTxn] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refunded = status === 'refunded';

  async function run() {
    setError(null);
    if (refunded) {
      const v = Number(amount);
      if (!amount || Number.isNaN(v) || v <= 0) return setError('Enter the amount you sent back.');
      if (note.trim().length < 3) return setError('Write a note: how and when the money was sent.');
      if (role === 'seller' && files.length === 0) return setError('Attach a screenshot or file that proves you sent the money.');
    }
    setBusy(true);
    try {
      const input = { status, amount: refunded ? Number(amount) : undefined, note: note.trim() || undefined, transactionId: txn.trim() || undefined, files };
      if (target.kind === 'change') await changeRefundStatus(role, target.id, input);
      else if (target.kind === 'addOrder') await addOrderRefundRecord(target.orderId, input);
      else await addReturnMoneyRecord(target.returnId, input);
      showToast(refunded ? 'Saved. The refund is marked as refunded.' : 'Saved.', 'success');
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  const title = target.kind === 'change' ? (role === 'admin' ? 'Change the refund status' : refunded ? 'Mark as refunded' : 'Start the refund') : 'Add another record';
  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-3 p-5">
        {role === 'admin' && (
          <label className="block text-sm font-semibold">
            Status
            <select className={field} value={status} onChange={(e) => setStatus(e.target.value as RefundStatus)}>
              {(['needs_to_refund', 'processing', 'refunded', ...(target.kind === 'change' ? ['voided'] : [])] as RefundStatus[]).map((s) => (
                <option key={s} value={s} disabled={target.kind === 'change' && s === target.from}>{REFUND_STATUS_WORD[s]}</option>
              ))}
            </select>
          </label>
        )}
        {refunded ? (
          <>
            <p className="text-sm text-muted-foreground">The amount must be exactly what the buyer paid: <span className="font-semibold">{formatMoney(expected)}</span>. Any other amount is refused.</p>
            <label className="block text-sm font-semibold">Amount you sent back (USD)<input inputMode="decimal" className={field} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <label className="block text-sm font-semibold">Note: how and when you sent it<input className={field} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: Sent by PayPal to 01799990001 today at 3 pm" /></label>
            <label className="block text-sm font-semibold">Transaction ID (optional)<input className={field} maxLength={120} value={txn} onChange={(e) => setTxn(e.target.value)} /></label>
            <label className="block text-sm font-semibold">Proof{role === 'seller' ? '' : ' (optional)'}: a screenshot or file<input type="file" accept="image/*,.pdf" multiple className="mt-1 block w-full text-sm" onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))} /></label>
          </>
        ) : (
          <label className="block text-sm font-semibold">Note (optional)<input className={field} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-5 py-2.5 font-medium hover:bg-muted">Cancel</button>
          <button type="button" disabled={busy} onClick={run} className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </Modal>
  );
}

/** The buttons for one refund record: a seller steps it on; an admin can set any status. */
export function RefundActions({ role, id, status, expected, onDone }: { role: 'admin' | 'seller'; id: number; status: RefundStatus; expected: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  if (role === 'seller' && (status === 'refunded' || status === 'voided')) return null;
  const next: RefundStatus = status === 'needs_to_refund' ? 'processing' : 'refunded';
  const label = role === 'admin' ? 'Change status' : status === 'needs_to_refund' ? 'Start the refund' : 'Mark as refunded';
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">{label}</button>
      {open && <RefundModal role={role} target={{ kind: 'change', id, from: status }} expected={expected} initial={role === 'admin' ? (status === 'refunded' ? 'needs_to_refund' : next) : next} onClose={() => setOpen(false)} onDone={() => { setOpen(false); onDone(); }} />}
    </>
  );
}

/** Admin only: add another record (a cancelled order, or a return) when what was recorded earlier is disputed. */
export function AddRefundRecord({ orderId, returnId, expected, label, onDone }: { orderId?: number; returnId?: number; expected: number; label?: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const target: Target = returnId ? { kind: 'addReturn', returnId } : { kind: 'addOrder', orderId: orderId as number };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted">{label ?? 'Add another record'}</button>
      {open && <RefundModal role="admin" target={target} expected={expected} initial="refunded" onClose={() => setOpen(false)} onDone={() => { setOpen(false); onDone(); }} />}
    </>
  );
}
