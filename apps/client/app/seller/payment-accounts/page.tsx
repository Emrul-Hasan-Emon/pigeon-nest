'use client';

import { PaymentAccounts } from '@/components/payments/payment-accounts';
import { SellerFrame } from '@/components/seller/seller-frame';

export default function SellerPaymentAccountsPage() {
  return (
    <SellerFrame width="max-w-4xl">
      <h1 className="mb-1 text-foreground">Payment accounts</h1>
      <p className="mb-5 text-base text-muted-foreground">Add the bKash, Nagad or bank account where buyers should send money. After a buyer orders, they see these details on their order page and can tell you when they have paid.</p>
      <PaymentAccounts role="seller" />
    </SellerFrame>
  );
}
