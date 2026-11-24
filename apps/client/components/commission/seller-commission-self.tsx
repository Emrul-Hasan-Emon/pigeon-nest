'use client';

import { useEffect, useState } from 'react';
import { useApiError, money } from '@/components/orders/ui';
import { sellerCommission } from '@/lib/api/commission';
import type { BalanceDetail } from '@/types/commission';
import { Cards, ruleText } from './parts';
import { ChangeLog } from './change-log';
import { DisburseList } from './disburse-list';
import { LedgerList } from './ledger-list';
import { SettingHistory } from './setting-history';
import { LoadingBlock } from '@/components/ui/skeleton';

type Tab = 'ledger' | 'changes' | 'payments' | 'rule';

/** Seller portal: what they owe the platform, their rate, the ledger and their payments. Read only. */
export function SellerCommissionSelf() {
  const errorMessage = useApiError('seller');
  const [b, setB] = useState<BalanceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('ledger');
  useEffect(() => {
    sellerCommission.balance().then(setB).catch((e) => setError(errorMessage(e, 'Failed to load your system commission.')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (error) return <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>;
  if (!b) return <LoadingBlock />;
  const tabs: [Tab, string][] = [['ledger', 'System commission records'], ['changes', 'Balance changes'], ['payments', 'My payments'], ['rule', 'Rate history']];
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">System commission</h1>
        <p className="text-sm text-muted-foreground">
          The platform takes <strong>{ruleText(b.commission.effective)}</strong> of each item on an order. It counts once the order is fully paid, and comes back off if the item is returned.
        </p>
      </div>
      <Cards items={[
        { label: 'System commission on your paid orders', value: money(b.totalCommission), hint: 'Added up from every order that is fully paid' },
        { label: 'Still to pay the platform', value: money(b.dueCommission), tone: b.dueCommission > 0 ? 'warn' : undefined, hint: b.dueCommission < 0 ? 'Below zero: the platform owes you' : 'What you owe right now' },
        { label: 'Already paid', value: money(b.paidCommission), tone: 'good', hint: 'What you have paid the platform so far' },
      ]} />
      <div className="mb-4 flex gap-1 border-b border-border">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{label}</button>
        ))}
      </div>
      {tab === 'ledger' && <LedgerList role="seller" />}
      {tab === 'changes' && <ChangeLog role="seller" />}
      {tab === 'payments' && <DisburseList role="seller" />}
      {tab === 'rule' && <SettingHistory role="seller" />}
    </div>
  );
}
