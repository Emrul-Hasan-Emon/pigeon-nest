export type RefundStatus = 'needs_to_refund' | 'processing' | 'refunded' | 'voided';

export const REFUND_STATUS_WORD: Record<RefundStatus, string> = {
  needs_to_refund: 'Needs to be refunded',
  processing: 'Being refunded',
  refunded: 'Refunded',
  voided: 'No longer needed',
};

export interface RefundProofFile {
  kind: 'image' | 'file';
  fileName: string;
  fileUrl: string;
}

export interface RefundHistoryEntry {
  id: number;
  fromStatus: RefundStatus | null;
  status: RefundStatus;
  amount: number | null;
  note: string | null;
  by: string | null;
  byType: string | null;
  createdAt: string;
  attachments: RefundProofFile[];
}

/** One attempt to give the buyer their money back, with its history. The buyer, seller and admin all see this. */
export interface RefundRecord {
  id: number;
  kind: 'cancelled_order' | 'return';
  orderReturnId: number | null;
  status: RefundStatus;
  expectedAmount: number;
  amount: number | null;
  note: string | null;
  transactionId: string | null;
  proof: RefundProofFile[];
  refundedAt: string | null;
  refundedByName: string | null;
  createdAt: string;
  history: RefundHistoryEntry[];
}

/** A refund as the staff list shows it, with its order. */
export interface RefundRow {
  id: number;
  status: RefundStatus;
  expectedAmount: number;
  amount: number | null;
  note: string | null;
  refundedAt: string | null;
  createdAt: string;
  recordsOnOrder: number;
  order: { id: number; orderNumber: string; status: string; amountPaid: number; customerName: string; customerPhone: string; sellerName: string | null };
}

export interface RefundPage {
  results: RefundRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface RefundInput {
  status: RefundStatus;
  amount?: number;
  note?: string;
  transactionId?: string;
  files?: File[];
}
