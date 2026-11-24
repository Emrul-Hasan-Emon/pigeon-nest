import { http, sellerHttp } from './http';
import type { RefundInput, RefundPage, RefundRecord, RefundStatus } from '@/types/refund';

type Role = 'admin' | 'seller';
const client = (role: Role) => (role === 'admin' ? http : sellerHttp);

function form(input: Partial<RefundInput>) {
  const f = new FormData();
  if (input.status) f.append('status', input.status);
  if (input.amount !== undefined) f.append('amount', String(input.amount));
  if (input.note) f.append('note', input.note);
  if (input.transactionId) f.append('transactionId', input.transactionId);
  for (const file of input.files ?? []) f.append('files', file);
  return f;
}

export const listRefunds = (role: Role, params: { status?: RefundStatus; search?: string; page?: number; pageSize?: number }) => client(role).get<RefundPage>('/order/refunds', { ...params });
export const getRefundSummary = (role: Role) => client(role).get<{ needsToRefund: number; processing: number; refunded: number }>('/order/refunds/summary');
export const getRefund = (role: Role, id: number) => client(role).get<RefundRecord>(`/order/refunds/${id}`);
export const changeRefundStatus = (role: Role, id: number, input: RefundInput) => client(role).post<RefundRecord>(`/order/refunds/${id}/status`, form(input));

// Admin only: another record on a cancelled order, or on a return
export const addOrderRefundRecord = (orderId: number, input: Partial<RefundInput>) => http.post<RefundRecord>(`/order/${orderId}/refunds`, form(input));
export const addReturnMoneyRecord = (returnId: number, input: Partial<RefundInput>) => http.post<RefundRecord>(`/order/returns/${returnId}/money-records`, form(input));
