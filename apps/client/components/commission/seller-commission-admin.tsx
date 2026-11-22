'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api/http';
import { adminCommission } from '@/lib/api/commission';
import { FilePicker, field, money, primaryButton } from '@/components/orders/ui';
import type { BalanceDetail, CommissionType } from '@/types/commission';
import { Cards, ruleText } from './parts';
import { DisburseList } from './disburse-list';
import { ChangeLog } from './change-log';
import { LedgerList } from './ledger-list';
import { SettingHistory } from './setting-history';

type Tab = 'ledger' | 'changes' | 'payments' | 'rule';

/** Admin: one seller's commission: balance, their rate, record a payment, ledger and history. */
export function SellerCommissionAdmin({ sellerId }: { sellerId: number }) {
  const { showToast } = useToast();
  const [b, setB] = useState<BalanceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('ledger');
  const [refresh, setRefresh] = useState(0);

  const load = useCallback(() => {
    adminCommission.balance(sellerId).then(setB).catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load.'));
  }, [sellerId]);
  useEffect(() => {
    load();
  }, [load]);

  // payment form
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // rate form
  const [ruleType, setRuleType] = useState<CommissionType>('percentage');
  const [ruleAmount, setRuleAmount] = useState('');
  const [ruleNote, setRuleNote] = useState('');
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [savingRule, setSavingRule] = useState(false);
  useEffect(() => {
    if (!b) return;
    const e = b.commission.effective;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRuleType(e.type);
    setRuleAmount(String(e.value));
  }, [b]);

  async function pay(event: React.FormEvent) {
    event.preventDefault();
    setPayError(null);
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim()) || Number(amount) <= 0) return setPayError('Enter an amount above 0 with at most 2 decimals.');
    if (b && Number(amount) > b.dueCommission) return setPayError(`The amount cannot be more than the commission due (${money(b.dueCommission)}).`);
    setPaying(true);
    try {
      await adminCommission.disburse(sellerId, { amount: amount.trim(), notes: notes.trim() || undefined }, files);
      showToast('Commission payment recorded.', 'success');
      setAmount('');
      setNotes('');
      setFiles([]);
      setRefresh((n) => n + 1);
      load();
    } catch (e) {
      setPayError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setPaying(false);
    }
  }

  async function saveRule(event: React.FormEvent) {
    event.preventDefault();
    setRuleError(null);
    const n = Number(ruleAmount);
    if (ruleAmount.trim() === '' || !Number.isFinite(n) || n < 0) return setRuleError('Enter an amount of 0 or more.');
    if (Math.round(n * 100) / 100 !== n) return setRuleError('The amount can have at most 2 decimals.');
    if (ruleType === 'percentage' && n > 100) return setRuleError('A percentage cannot be more than 100.');
    setSavingRule(true);
    try {
      await adminCommission.setRule(sellerId, ruleType, n, ruleNote.trim() || undefined);
      showToast('Commission rate saved.', 'success');
      setRuleNote('');
      setRefresh((c) => c + 1);
      load();
    } catch (e) {
      setRuleError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSavingRule(false);
    }
  }

  if (error) return <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>;
  if (!b) return <p className="py-10 text-center text-muted-foreground">Loading…</p>;
  const tabs: [Tab, string][] = [['ledger', 'Ledger'], ['changes', 'Balance changes'], ['payments', 'Payments received'], ['rule', 'Rate history']];

  return (
    <div>
      <Link href="/admin/commission" className="text-sm text-primary hover:underline">← Commission balances</Link>
      <div className="mb-4 mt-2 flex flex-wrap items-baseline gap-x-4">
        <h1 className="text-2xl font-bold text-foreground">{b.sellerName}</h1>
        <Link href={`/admin/sellers/${sellerId}`} className="text-sm text-primary hover:underline">View seller</Link>
        <span className="text-sm text-muted-foreground">Rate: {ruleText(b.commission.effective)}</span>
      </div>
      <Cards items={[
        { label: 'Total commission', value: money(b.totalCommission), hint: 'Earned from fully paid orders' },
        { label: 'Due', value: money(b.dueCommission), tone: b.dueCommission > 0 ? 'warn' : undefined, hint: b.dueCommission < 0 ? 'Below zero: the platform owes this seller' : 'Not yet received from the seller' },
        { label: 'Paid', value: money(b.paidCommission), tone: 'good', hint: 'Received from the seller' },
      ]} />

      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <form onSubmit={pay} className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-1 font-semibold text-foreground">Record a payment from this seller</h2>
          <p className="mb-3 text-xs text-muted-foreground">Due now: <strong>{money(Math.max(0, b.dueCommission))}</strong>. The amount moves from due to paid. Files are optional.</p>
          {payError && <p role="alert" className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{payError}</p>}
          <div className="space-y-3">
            <input className={`${field} w-full`} inputMode="decimal" placeholder="Amount received" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={b.dueCommission <= 0} />
            <textarea className={`${field} w-full`} rows={2} maxLength={1000} placeholder="Notes (optional): bank reference, who handed it over…" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <FilePicker files={files} onChange={setFiles} />
            <button type="submit" disabled={paying || b.dueCommission <= 0} className={primaryButton}>{paying ? 'Saving…' : 'Record payment'}</button>
          </div>
        </form>

        <form onSubmit={saveRule} className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-1 font-semibold text-foreground">Commission rate</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            {b.commission.setting ? 'This seller has their own rate.' : `No own rate: the global rate applies (${ruleText(b.commission.global)}).`} A change affects new orders only. It is worked out for each item and added up for the order.
          </p>
          {ruleError && <p role="alert" className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{ruleError}</p>}
          <div className="space-y-3">
            <select className={`${field} w-full`} value={ruleType} onChange={(e) => setRuleType(e.target.value as CommissionType)} aria-label="Commission type">
              <option value="percentage">Percentage of each item</option>
              <option value="fixed">Fixed amount per item</option>
            </select>
            <input className={`${field} w-full`} inputMode="decimal" placeholder={ruleType === 'percentage' ? 'Percentage (0 to 100)' : 'Amount per item'} value={ruleAmount} onChange={(e) => setRuleAmount(e.target.value)} />
            <input className={`${field} w-full`} maxLength={500} placeholder="Note for the history (optional)" value={ruleNote} onChange={(e) => setRuleNote(e.target.value)} />
            <button type="submit" disabled={savingRule} className={primaryButton}>{savingRule ? 'Saving…' : 'Save rate'}</button>
          </div>
        </form>
      </div>

      <div className="mb-4 flex gap-1 border-b border-border">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{label}</button>
        ))}
      </div>
      <div key={`${tab}-${refresh}`}>
        {tab === 'ledger' && <LedgerList role="admin" sellerId={sellerId} />}
        {tab === 'changes' && <ChangeLog role="admin" sellerId={sellerId} />}
        {tab === 'payments' && <DisburseList role="admin" sellerId={sellerId} />}
        {tab === 'rule' && <SettingHistory role="admin" sellerId={sellerId} />}
      </div>
    </div>
  );
}
