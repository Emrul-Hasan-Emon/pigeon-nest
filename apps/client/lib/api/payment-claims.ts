import { http, sellerHttp, userHttp } from './http';
import type { ClaimPage, PaymentAccount, PaymentAccountInput, PaymentClaimStatus, Statement } from '@/types/payment';

// Seller payment accounts (the seller's own) and the admin's view of any seller's
export const listMyPaymentAccounts = () => sellerHttp.get<PaymentAccount[]>('/profile/payment-accounts');
export const createMyPaymentAccount = (input: PaymentAccountInput) => sellerHttp.post<PaymentAccount>('/profile/payment-accounts', input);
export const updateMyPaymentAccount = (id: number, input: PaymentAccountInput) => sellerHttp.patch<PaymentAccount>(`/profile/payment-accounts/${id}`, input);
export const listSellerPaymentAccounts = (sellerId: number) => http.get<PaymentAccount[]>(`/seller/${sellerId}/payment-accounts`);
export const createSellerPaymentAccount = (sellerId: number, input: PaymentAccountInput) => http.post<PaymentAccount>(`/seller/${sellerId}/payment-accounts`, input);
export const updateSellerPaymentAccount = (sellerId: number, id: number, input: PaymentAccountInput) => http.patch<PaymentAccount>(`/seller/${sellerId}/payment-accounts/${id}`, input);

// "I have paid" messages
export interface ClaimInput {
  amount: number;
  transactionId: string;
  method: string;
  senderNumber?: string;
  paidOn?: string;
  note?: string;
  files?: File[];
}
export function createPaymentClaim(orderId: number, input: ClaimInput) {
  const form = new FormData();
  form.append('amount', String(input.amount));
  form.append('transactionId', input.transactionId);
  form.append('method', input.method);
  for (const k of ['senderNumber', 'paidOn', 'note'] as const) if (input[k]) form.append(k, String(input[k]));
  for (const f of input.files ?? []) form.append('files', f);
  return userHttp.post<{ id: number; status: string }>(`/orders/${orderId}/payment-claims`, form);
}

type Role = 'admin' | 'seller';
const client = (role: Role) => (role === 'admin' ? http : sellerHttp);
export const listPaymentClaims = (role: Role, params: { status?: PaymentClaimStatus; page?: number; pageSize?: number }) => client(role).get<ClaimPage>('/payment-claims', { ...params });
export const getPendingClaimCount = (role: Role) => client(role).get<{ pending: number }>('/payment-claims/summary');
export const confirmPaymentClaim = (role: Role, id: number, body: { amount?: number; note?: string }) => client(role).post<{ id: number; orderId: number }>(`/payment-claims/${id}/confirm`, body);
export const rejectPaymentClaim = (role: Role, id: number, reason: string) => client(role).post<{ id: number }>(`/payment-claims/${id}/reject`, { reason });

// Monthly statement
export const getMyStatement = (month: string) => sellerHttp.get<Statement>('/reports/statement', { month });
export const getSellerStatement = (sellerId: number, month: string) => http.get<Statement>('/reports/statement', { sellerId, month });
