'use client';

import { StatementView } from '@/components/payments/statement-view';
import { SellerFrame } from '@/components/seller/seller-frame';

export default function SellerStatementsPage() {
  return (
    <SellerFrame width="max-w-5xl">
      <div className="print:hidden">
        <h1 className="mb-1 text-foreground">Monthly statement</h1>
        <p className="mb-5 text-base text-muted-foreground">Your sales, the system commission, refunds, what you paid the marketplace and what you owe, for one month. Press Print to keep a copy.</p>
      </div>
      <StatementView role="seller" />
    </SellerFrame>
  );
}
