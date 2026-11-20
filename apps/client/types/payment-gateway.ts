export type GatewayType = 'cod' | 'mfs' | 'card' | 'bank' | 'manual';
export type AccountField = 'accountName' | 'accountNumber' | 'bankName' | 'branchName';

export interface ProofField {
  key: string;
  label: string;
  required: boolean;
}

export interface PaymentGateway {
  id: number;
  name: string;
  slug: string;
  type: GatewayType;
  description: string | null;
  iconUrl: string | null;
  accountName: string | null;
  accountNumber: string | null;
  bankName: string | null;
  branchName: string | null;
  isActive: boolean;
  proofFields: ProofField[];
  createdAt: string;
  updatedAt: string;
}

export interface GatewayTypeRule {
  type: GatewayType;
  label: string;
  allowedFields: AccountField[];
  requiredFields: AccountField[];
  needsDescription: boolean;
  proofFields: ProofField[];
}

export interface GatewayListParams {
  search?: string;
  type?: GatewayType;
  isActive?: boolean;
  cursor?: number;
  limit?: number;
}

export interface GatewayListResponse {
  results: PaymentGateway[];
  nextCursor: number | null;
}
