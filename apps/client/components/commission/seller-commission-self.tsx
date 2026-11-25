'use client';

import { useEffect, useState } from 'react';
import { useApiError, money } from '@/components/orders/ui';
import { sellerCommission } from '@/lib/api/commission';
import type { BalanceDetail, CommissionRule, EffectiveRule } from '@/types/commission';
import { Cards, ruleLabel } from './parts';
import { ChangeLog } from './change-log';
import { DisburseList } from './disburse-list';
import { LedgerList } from './ledger-list';
import { SettingHistory } from './setting-history';
import { LoadingBlock } from '@/components/ui/skeleton';
import { formatMoney } from '@/lib/money';

type Tab = 'ledger' | 'changes' | 'payments' | 'rule';

/** Seller portal: what they owe the platform, their rate, the ledger and their payments. Read only. */
/** The seller's current rate, its type and who set it, in plain words. */
function RateCard({ rate, global }: { rate: EffectiveRule; global: CommissionRule }) {
  const percent = rate.type === 'percentage';
  const own = rate.source === 'seller';
  return (
    <section aria-label="Your system commission rate" className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-muted-foreground">Your system commission rate</p>
        <p className="mt-1 font-[family-name:var(--font-serif)] text-4xl font-semibold text-foreground">
          {percent ? `${rate.value}%` : `${formatMoney(rate.value)}`}
          <span className="ml-2 text-base font-normal text-muted-foreground">{percent ? 'of each item' : 'for each item'}</span>
        </p>
      </div>
      <dl className="grid gap-x-8 gap-y-1 text-base sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">Type</dt>
          <dd className="font-medium text-foreground">{percent ? 'Percentage: a share of each item\'s price' : 'Fixed amount: the same for every item sold'}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Set by</dt>
          <dd className="font-medium text-foreground">{own ? 'The marketplace, just for you' : 'The marketplace rate, the same for all sellers'}</dd>
        </div>
        {own && (
          <div className="sm:col-span-2">
            <dt className="text-sm text-muted-foreground">Marketplace rate for other sellers</dt>
            <dd className="font-medium text-foreground">{ruleLabel(global)}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

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
          The platform takes this fee on each item you sell. It counts once the order is fully paid, and comes back off if the item is returned.
        </p>
      </div>
      <RateCard rate={b.commission.effective} global={b.commission.global} />
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
