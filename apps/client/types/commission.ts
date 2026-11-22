
export type CommissionType = 'percentage' | 'fixed';
export type CommissionRole = 'admin' | 'seller';

export interface CommissionRule {
  type: CommissionType;
  value: number;
}

export interface EffectiveRule extends CommissionRule {
  source: 'seller' | 'global';
}

export interface RuleView {
  sellerId: number;
  setting: { id: number; commissionType: CommissionType; commissionAmount: number; updatedAt: string } | null;
  global: CommissionRule;
  effective: EffectiveRule;
}

export interface BalanceRow {
  id: number;
  sellerId: number;
  sellerName: string;
  sellerPhone: string | null;
  totalCommission: number;
  dueCommission: number;
  paidCommission: number;
  updatedAt: string;
}

export interface BalanceDetail {
  sellerId: number;
  sellerName: string;
  sellerPhone: string | null;
  totalCommission: number;
  dueCommission: number;
  paidCommission: number;
  updatedAt: string | null;
  commission: { setting: RuleView['setting']; global: CommissionRule; effective: EffectiveRule };
}

export interface LedgerRow {
  id: number;
  sellerId: number;
  sellerName: string | null;
  orderId: number | null;
  orderNumber: string | null;
  disburseId: number | null;
  type: 'order_commission' | 'commission_payment' | 'order_return';
  status: string;
  orderItemId: number | null;
  orderReturnId: number | null;
  totalAmount: number;
  orderSubtotal: number | null;
  commissionType: CommissionType | null;
  commissionValue: number | null;
  paymentStatus: string;
  totalAfter: number;
  dueAfter: number;
  paidAfter: number;
  createdAt: string;
  voidedAt: string | null;
  voidReason: string | null;
}

export interface DisburseRow {
  id: number;
  sellerId: number;
  sellerName: string | null;
  amount: number;
  notes: string | null;
  totalAmount: number;
  dueAmount: number;
  paidAmount: number;
  createdAt: string;
  recordedByName: string | null;
  attachmentCount: number;
}

export interface DisburseDetail extends Omit<DisburseRow, 'attachmentCount'> {
  attachments: { id: number; kind: 'image' | 'file'; fileName: string; url: string; mimeType: string; size: number }[];
}

export interface SettingHistoryRow {
  id: number;
  sellerId: number;
  sellerName: string | null;
  settingType: string;
  action: 'created' | 'updated';
  fromValue: { commissionType: CommissionType | null; commissionAmount: number | null } | null;
  toValue: { commissionType: CommissionType | null; commissionAmount: number | null };
  note: string | null;
  changedAt: string;
  changedByName: string | null;
  changedByType: string | null;
}

export interface Page<T> {
  results: T[];
  nextCursor: number | null;
}
