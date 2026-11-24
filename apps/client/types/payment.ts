/** A bank or mobile money account where buyers pay a seller. */
export interface PaymentAccount {
  id: number;
  kind: 'mfs' | 'bank';
  provider: string;
  accountName: string | null;
  accountNumber: string;
  branchName: string | null;
  note: string | null;
  isActive: boolean;
}

export interface PaymentAccountInput {
  kind?: 'mfs' | 'bank';
  provider?: string;
  accountName?: string;
  accountNumber?: string;
  branchName?: string;
  note?: string;
  isActive?: boolean;
}

export type PaymentClaimStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled';

/** A buyer's "I have paid" message about an order. */
export interface PaymentClaim {
  id: number;
  amount: number;
  transactionId: string | null;
  method: string | null;
  senderNumber: string | null;
  paidOn: string | null;
  note: string | null;
  status: PaymentClaimStatus;
  decisionNote: string | null;
  decidedAt: string | null;
  decidedByName: string | null;
  createdAt: string;
  attachments: { kind: 'image' | 'file'; fileName: string; fileUrl: string }[];
}

/** A claim as the shop and staff list it, with its order. */
export interface StaffPaymentClaim extends PaymentClaim {
  order: { id: number; orderNumber: string; payable: number; paid: number };
  buyerName: string;
  paymentId: number | null;
}

export interface ClaimPage {
  results: StaffPaymentClaim[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Statement {
  seller: { id: number; name: string; phone: string | null };
  month: string;
  from: string;
  to: string;
  generatedAt: string;
  summary: {
    paidOrders: number;
    sales: number;
    systemCommission: number;
    refunds: number;
    systemCommissionGivenBack: number;
    netSystemCommission: number;
    youKeep: number;
    paidToMarketplace: number;
    owedAtStart: number;
    owedAtEnd: number;
  };
  orders: { id: number; orderNumber: string; date: string; amount: number; systemCommission: number; youKeep: number }[];
  refunds: { id: number; returnNumber: string; date: string; refund: number; systemCommissionGivenBack: number }[];
  payments: { id: number; date: string; amount: number; note: string | null }[];
}
