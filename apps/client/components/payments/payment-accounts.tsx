'use client';

import { useCallback, useEffect, useState } from 'react';
import { Landmark, Smartphone } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api/http';
import {
  createMyPaymentAccount,
  createSellerPaymentAccount,
  listMyPaymentAccounts,
  listSellerPaymentAccounts,
  updateMyPaymentAccount,
  updateSellerPaymentAccount,
} from '@/lib/api/payment-claims';
import type { PaymentAccount, PaymentAccountInput } from '@/types/payment';

const PROVIDERS = ['PayPal', 'Wise', 'Zelle', 'Venmo'];
const input = 'mt-1 w-full rounded-md border border-input px-3 py-2';

function AccountForm({ initial, onSave, onClose, busy, error }: { initial: PaymentAccount | null; onSave: (v: PaymentAccountInput) => void; onClose: () => void; busy: boolean; error: string | null }) {
  const [kind, setKind] = useState<'mfs' | 'bank'>(initial?.kind ?? 'mfs');
  const [provider, setProvider] = useState(initial?.provider ?? '');
  const [number, setNumber] = useState(initial?.accountNumber ?? '');
  const [name, setName] = useState(initial?.accountName ?? '');
  const [branch, setBranch] = useState(initial?.branchName ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const bank = kind === 'bank';
  return (
    <Modal title={initial ? 'Change payment account' : 'Add a payment account'} onClose={onClose}>
      <form
        className="space-y-3 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ ...(initial ? {} : { kind }), provider: provider.trim(), accountNumber: number.trim(), accountName: name.trim(), branchName: bank ? branch.trim() : '', note: note.trim() });
        }}
      >
        {!initial && (
          <fieldset className="flex gap-3">
            <legend className="mb-1 text-sm font-semibold">What kind of account?</legend>
            {(['mfs', 'bank'] as const).map((k) => (
              <label key={k} className={`flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 font-medium ${kind === k ? 'border-primary bg-accent' : 'border-border'}`}>
                <input type="radio" name="kind" checked={kind === k} onChange={() => { setKind(k); setProvider(''); }} />
                {k === 'mfs' ? 'Online wallet' : 'Bank account'}
              </label>
            ))}
          </fieldset>
        )}
        <label className="block text-sm">
          {bank ? 'Bank name' : 'Service'}
          <input list={bank ? undefined : 'providers'} className={input} value={provider} onChange={(e) => setProvider(e.target.value)} placeholder={bank ? 'For example: Chase Bank' : 'For example: PayPal'} required maxLength={80} />
          {!bank && <datalist id="providers">{PROVIDERS.map((p) => <option key={p} value={p} />)}</datalist>}
        </label>
        <label className="block text-sm">
          {bank ? 'Account number' : 'Mobile number'}
          <input className={input} value={number} onChange={(e) => setNumber(e.target.value)} required minLength={3} maxLength={60} inputMode={bank ? 'text' : 'tel'} />
        </label>
        <label className="block text-sm">
          {bank ? 'Account holder name' : 'Account name (optional)'}
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} required={bank} maxLength={120} />
        </label>
        {bank && (
          <label className="block text-sm">
            Branch (optional)
            <input className={input} value={branch} onChange={(e) => setBranch(e.target.value)} maxLength={120} />
          </label>
        )}
        <label className="block text-sm">
          A note for buyers (optional)
          <input className={input} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={bank ? 'For example: write your order number in the reference' : 'For example: Personal number, use Send Money'} />
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-5 py-2.5 font-medium hover:bg-muted">Cancel</button>
          <button type="submit" disabled={busy} className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * The bank and online wallet accounts where buyers send money for a seller's orders. The seller manages their own;
 * the admin can see and fix any seller's. Accounts are switched off, never deleted.
 */
export function PaymentAccounts({ role, sellerId }: { role: 'seller' | 'admin'; sellerId?: number }) {
  const { showToast } = useToast();
  const [rows, setRows] = useState<PaymentAccount[] | null>(null);
  const [editing, setEditing] = useState<PaymentAccount | 'new' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useCallback(() => (role === 'admin' ? listSellerPaymentAccounts(sellerId as number) : listMyPaymentAccounts()), [role, sellerId]);

  useEffect(() => {
    let live = true;
    list()
      .then((r) => live && setRows(r))
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [list]);

  async function save(values: PaymentAccountInput) {
    setBusy(true);
    setError(null);
    try {
      if (editing === 'new') {
        const created = role === 'admin' ? await createSellerPaymentAccount(sellerId as number, values) : await createMyPaymentAccount(values);
        setRows((c) => [...(c ?? []), created]);
      } else if (editing) {
        const updated = role === 'admin' ? await updateSellerPaymentAccount(sellerId as number, editing.id, values) : await updateMyPaymentAccount(editing.id, values);
        setRows((c) => (c ?? []).map((r) => (r.id === updated.id ? updated : r)));
      }
      setEditing(null);
      showToast('Saved.', 'success');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(a: PaymentAccount) {
    try {
      const updated = role === 'admin' ? await updateSellerPaymentAccount(sellerId as number, a.id, { isActive: !a.isActive }) : await updateMyPaymentAccount(a.id, { isActive: !a.isActive });
      setRows((c) => (c ?? []).map((r) => (r.id === updated.id ? updated : r)));
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not change it.', 'error');
    }
  }

  return (
    <section aria-labelledby="accounts-title" className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="accounts-title" className="text-lg font-semibold text-foreground">Payment accounts</h2>
          <p className="text-sm text-muted-foreground">Where buyers send money for {role === 'admin' ? "this seller's" : 'your'} orders. Buyers see the ones that are on, on their order page after they order.</p>
        </div>
        <button type="button" onClick={() => { setError(null); setEditing('new'); }} className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:opacity-90">Add an account</button>
      </div>
      {rows === null ? (
        <p className="py-6 text-center text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-muted-foreground">No payment account yet. Add your PayPal, Wise or bank account so buyers know where to pay.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((a) => (
            <li key={a.id} className={`rounded-xl border p-4 ${a.isActive ? 'border-border' : 'border-dashed border-border bg-muted/40'}`}>
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted">{a.kind === 'bank' ? <Landmark className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{a.provider} {!a.isActive && <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Off</span>}</p>
                  <p className="text-lg font-semibold tabular-nums text-foreground">{a.accountNumber}</p>
                  {a.accountName && <p className="text-sm text-muted-foreground">{a.accountName}{a.branchName ? ` · ${a.branchName}` : ''}</p>}
                  {a.note && <p className="mt-1 text-sm text-muted-foreground">{a.note}</p>}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => { setError(null); setEditing(a); }} className="rounded-lg border border-border px-4 py-1.5 text-sm font-semibold hover:bg-muted">Change</button>
                <button type="button" onClick={() => toggle(a)} className="rounded-lg border border-border px-4 py-1.5 text-sm font-semibold hover:bg-muted">{a.isActive ? 'Switch off' : 'Switch on'}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && <AccountForm key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? null : editing} onSave={save} onClose={() => setEditing(null)} busy={busy} error={error} />}
    </section>
  );
}
