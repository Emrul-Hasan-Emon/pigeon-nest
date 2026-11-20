import { PaymentGatewayType } from '../../database/enums/payment-gateway-type.enum';

export type AccountField = 'accountName' | 'accountNumber' | 'bankName' | 'branchName';

export interface ProofField {
  key: string;
  label: string;
  required: boolean;
}

interface TypeRule {
  /** Account details the admin may configure, and the subset that is required. */
  allowed: AccountField[];
  required: AccountField[];
  /** Whether the admin must write instructions for the customer. */
  needsDescription: boolean;
  /** What the customer submits at checkout as proof of payment. */
  proof: ProofField[];
}

export const GATEWAY_RULES: Record<PaymentGatewayType, TypeRule> = {
  [PaymentGatewayType.COD]: {
    allowed: [],
    required: [],
    needsDescription: false,
    proof: [],
  },
  [PaymentGatewayType.MFS]: {
    allowed: ['accountName', 'accountNumber'],
    required: ['accountNumber'],
    needsDescription: false,
    proof: [{ key: 'transactionId', label: 'Transaction ID', required: true }],
  },
  [PaymentGatewayType.BANK]: {
    allowed: ['accountName', 'accountNumber', 'bankName', 'branchName'],
    required: ['accountName', 'accountNumber', 'bankName'],
    needsDescription: false,
    proof: [
      { key: 'senderName', label: 'Name on the sending account', required: true },
      { key: 'transactionReference', label: 'Transfer reference', required: true },
    ],
  },
  [PaymentGatewayType.CARD]: {
    allowed: [],
    required: [],
    needsDescription: false,
    proof: [{ key: 'transactionReference', label: 'Payment reference', required: true }],
  },
  [PaymentGatewayType.MANUAL]: {
    allowed: ['accountName', 'accountNumber'],
    required: [],
    needsDescription: true,
    proof: [{ key: 'reference', label: 'Payment reference', required: false }],
  },
};

export const ACCOUNT_FIELD_LABELS: Record<AccountField, string> = {
  accountName: 'account name',
  accountNumber: 'account number',
  bankName: 'bank name',
  branchName: 'branch name',
};

export function proofFieldsFor(type: PaymentGatewayType): ProofField[] {
  return GATEWAY_RULES[type].proof;
}

export const GATEWAY_TYPE_LABELS: Record<PaymentGatewayType, string> = {
  [PaymentGatewayType.COD]: 'Cash on delivery',
  [PaymentGatewayType.MFS]: 'Mobile banking',
  [PaymentGatewayType.CARD]: 'Card',
  [PaymentGatewayType.BANK]: 'Bank transfer',
  [PaymentGatewayType.MANUAL]: 'Other (manual)',
};

/** The rules the admin form is built from, so the screen never copies them. */
export function gatewayTypeRules() {
  return (Object.keys(GATEWAY_RULES) as PaymentGatewayType[]).map((type) => ({
    type,
    label: GATEWAY_TYPE_LABELS[type],
    allowedFields: GATEWAY_RULES[type].allowed,
    requiredFields: GATEWAY_RULES[type].required,
    needsDescription: GATEWAY_RULES[type].needsDescription,
    proofFields: GATEWAY_RULES[type].proof,
  }));
}
