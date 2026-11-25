'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api/http';
import type { BulkProductAction, BulkProductPayload, BulkProductResult } from '@/types/product';
import { formatMoney } from '@/lib/money';

const SELLER_ACTIONS: { value: BulkProductAction; label: string }[] = [
  { value: 'activate', label: 'Switch on (show to buyers)' },
  { value: 'deactivate', label: 'Switch off (hide from buyers)' },
  { value: 'price', label: 'Change prices' },
];
const ADMIN_ACTIONS: { value: BulkProductAction; label: string }[] = [
  ...SELLER_ACTIONS,
  { value: 'approve', label: 'Approve' },
  { value: 'reject', label: 'Reject (needs a reason)' },
  { value: 'suspend', label: 'Suspend (needs a reason)' },
];

/**
 * The bar that appears when products are ticked: choose one thing to do to all of them. Each product is changed on
 * its own, so one that cannot change (for example a locked one) does not stop the rest.
 */
export function BulkProductBar({
  selected,
  admin,
  run,
  onDone,
  onClear,
}: {
  selected: number[];
  admin: boolean;
  run: (payload: BulkProductPayload) => Promise<BulkProductResult>;
  onDone: () => void;
  onClear: () => void;
}) {
  const { showToast } = useToast();
  const [action, setAction] = useState<BulkProductAction | ''>('');
  const [mode, setMode] = useState<'percent' | 'amount'>('percent');
  const [direction, setDirection] = useState<'increase' | 'decrease'>('increase');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [failures, setFailures] = useState<BulkProductResult['results']>([]);
  const [error, setError] = useState<string | null>(null);

  const n = selected.length;
  const field = 'rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground';
  const needsReason = action === 'reject' || action === 'suspend';

  function check(): boolean {
    setError(null);
    if (!action) {
      setError('Choose what to do.');
      return false;
    }
    if (action === 'price') {
      const v = Number(value);
      if (!value || Number.isNaN(v) || v <= 0) return (setError('Enter how much to change the prices by.'), false);
      if (!/^\d+(\.\d{1,2})?$/.test(value)) return (setError('Use at most 2 decimals.'), false);
      if (mode === 'percent' && direction === 'decrease' && v >= 100) return (setError('You cannot lower prices by 100% or more.'), false);
    }
    if (needsReason && reason.trim().length < 3) return (setError('Write the reason; the seller will see it.'), false);
    return true;
  }

  async function apply() {
    setConfirm(false);
    if (!action) return;
    setBusy(true);
    setFailures([]);
    try {
      const r = await run({
        productIds: selected,
        action,
        ...(action === 'price' ? { mode, direction, value: Number(value) } : {}),
        ...(needsReason ? { reason: reason.trim() } : {}),
      });
      const bad = r.results.filter((x) => !x.ok);
      showToast(bad.length === 0 ? `${r.updated} ${r.updated === 1 ? 'product' : 'products'} updated.` : `${r.updated} updated, ${bad.length} could not be changed.`, bad.length === 0 ? 'success' : 'error');
      setFailures(bad);
      if (r.updated > 0) onDone();
      if (bad.length === 0) {
        setAction('');
        setValue('');
        setReason('');
        onClear();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update the products.');
    } finally {
      setBusy(false);
    }
  }

  const summary =
    action === 'price'
      ? `${direction === 'increase' ? 'Raise' : 'Lower'} the price of every option of ${n} ${n === 1 ? 'product' : 'products'} by ${mode === 'percent' ? `${value}%` : `${formatMoney(value)}`}. Offer prices change the same way.`
      : `Apply "${(admin ? ADMIN_ACTIONS : SELLER_ACTIONS).find((a) => a.value === action)?.label ?? ''}" to ${n} ${n === 1 ? 'product' : 'products'}.`;

  return (
    <div className="sticky bottom-4 z-10 mt-4 rounded-xl border border-border bg-card p-4 shadow-lg">
      <div className="flex flex-wrap items-end gap-3">
        <p className="mr-auto text-base font-medium text-foreground">
          {n} {n === 1 ? 'product' : 'products'} selected
          <span className="block text-sm font-normal text-muted-foreground">Each one is changed on its own.</span>
        </p>
        <label className="text-sm font-medium text-foreground">
          Do this
          <select className={`${field} mt-1 block`} value={action} onChange={(e) => setAction(e.target.value as BulkProductAction)}>
            <option value="">Choose…</option>
            {(admin ? ADMIN_ACTIONS : SELLER_ACTIONS).map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </label>
        {action === 'price' && (
          <>
            <label className="text-sm font-medium text-foreground">
              Prices go
              <select className={`${field} mt-1 block`} value={direction} onChange={(e) => setDirection(e.target.value as 'increase' | 'decrease')}>
                <option value="increase">Up</option>
                <option value="decrease">Down</option>
              </select>
            </label>
            <label className="text-sm font-medium text-foreground">
              By
              <span className="mt-1 flex gap-2">
                <input inputMode="decimal" className={`${field} w-24`} value={value} onChange={(e) => setValue(e.target.value)} placeholder={mode === 'percent' ? '10' : '100'} aria-label="Amount" />
                <select className={field} value={mode} onChange={(e) => setMode(e.target.value as 'percent' | 'amount')} aria-label="Percent or dollars">
                  <option value="percent">%</option>
                  <option value="amount">$ (dollars)</option>
                </select>
              </span>
            </label>
          </>
        )}
        {needsReason && (
          <label className="min-w-56 flex-1 text-sm font-medium text-foreground">
            Reason
            <input className={`${field} mt-1 block w-full`} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
        )}
        <button type="button" className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted" onClick={onClear}>Clear</button>
        <button type="button" disabled={busy || !action} onClick={() => check() && setConfirm(true)} className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {busy ? 'Working…' : `Apply to ${n}`}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      {failures.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {failures.map((f) => <li key={f.id}><span className="font-semibold">{f.name ?? `Product #${f.id}`}:</span> {f.error}</li>)}
        </ul>
      )}
      {confirm && <ConfirmDialog title="Apply to these products?" description={summary} confirmLabel="Apply" confirmVariant="primary" onConfirm={apply} onClose={() => setConfirm(false)} />}
    </div>
  );
}
