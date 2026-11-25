'use client';

import { formatDateTime } from '@/lib/datetime';
import { ClaimBadge, ClaimDecision, ClaimFacts } from './claim-actions';
import type { OrderDetail } from '@/types/order';
import { formatMoney } from '@/lib/money';

const card = 'rounded-xl border border-border bg-card p-4 shadow-sm';

/** On a staff order page: where the buyer was told to pay, and the "I have paid" messages to check. */
export function OrderClaimsPanel({ role, order, onChanged }: { role: 'admin' | 'seller'; order: OrderDetail; onChanged: () => void }) {
  const claims = order.paymentClaims ?? [];
  const accounts = order.payTo ?? [];
  if (claims.length === 0 && accounts.length === 0) return null;
  const balance = Math.max(0, order.totals.balanceDue);
  return (
    <section className={card} aria-label="Payment messages and accounts">
      <h2 className="text-sm font-semibold text-foreground">Mark as paid request</h2>
      {claims.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">No request. {order.gateway.slug === 'cash-on-delivery' ? 'The buyer can send one request, after you accept the order, if they paid in advance.' : 'Mark as paid requests are only for cash on delivery orders.'}</p>
      ) : (
        <ul className="mt-2 space-y-3">
          {claims.map((c) => (
            <li key={c.id} className="rounded-lg border border-border p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <ClaimBadge status={c.status} />
                <span className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</span>
              </div>
              <ClaimFacts claim={c} />
              {c.status === 'pending' ? (
                <div className="mt-3"><ClaimDecision role={role} claim={c} balance={balance} onDone={onChanged} /></div>
              ) : (
                (c.decisionNote || c.decidedByName) && <p className="mt-2 text-sm text-muted-foreground">{c.decidedByName ? `${c.decidedByName}: ` : ''}{c.decisionNote}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {accounts.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <h3 className="text-sm font-semibold text-foreground">Where the buyer was told to pay</h3>
          <ul className="mt-1 grid gap-2 sm:grid-cols-2">
            {accounts.map((a) => (
              <li key={a.id} className={`rounded-lg border px-3 py-2 text-sm ${a.isActive ? 'border-border' : 'border-dashed border-border text-muted-foreground'}`}>
                <span className="font-semibold">{a.provider}</span> <span className="tabular-nums">{a.accountNumber}</span>
                {!a.isActive && <span className="ml-1 text-xs">(off)</span>}
                {a.accountName && <span className="block text-muted-foreground">{a.accountName}{a.branchName ? ` · ${a.branchName}` : ''}</span>}
              </li>
            ))}
          </ul>
          {order.totals.balanceDue > 0 && <p className="mt-2 text-sm text-muted-foreground">Still to pay: {formatMoney(order.totals.balanceDue)}</p>}
        </div>
      )}
    </section>
  );
}
