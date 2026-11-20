import { http, sellerHttp } from './http';
import { ENDPOINTS } from '../endpoints';
import type {
  CatalogProduct,
  CreateOrderInput,
  CustomerHit,
  OrderDetail,
  OrderListParams,
  OrderListResponse,
  OrderOptions,
  OrderStatus,
  PaymentDetail,
  PaymentListParams,
  PaymentListResponse,
  StaffRole,
} from '@/types/order';

/** The same calls for the admin and a seller: the server limits a seller to their own orders. */
export function orderApi(role: StaffRole) {
  const client = role === 'admin' ? http : sellerHttp;
  const e = role === 'admin' ? ENDPOINTS.admin : ENDPOINTS.seller;
  return {
    list: (params: OrderListParams) => client.get<OrderListResponse>(e.orders.list, { ...params }),
    detail: (id: number) => client.get<OrderDetail>(e.orders.detail(id)),
    changeStatus: (id: number, status: OrderStatus, note?: string) =>
      client.patch<OrderDetail>(e.orders.status(id), { status, ...(note ? { note } : {}) }),
    create: (input: CreateOrderInput) => client.post<OrderDetail>(e.orders.list, input),
    findCustomers: (q: string) => client.get<{ results: CustomerHit[] }>(e.orders.customers, { q }),
    catalog: (params: { sellerId?: number; search?: string }) =>
      client.get<{ results: CatalogProduct[] }>(e.orders.catalog, { ...params }),
    options: (params: { countryCode?: string; subtotal?: number } = {}) =>
      client.get<OrderOptions>(e.orders.options, { ...params }),
    recordPayment: (
      id: number,
      fields: { description: string; amount?: string; transactionId?: string; paidAt?: string },
      files: File[],
    ) => client.post<{ orderId: number; paymentId: number }>(e.orders.payments(id), formData(fields, files)),
    reversePayment: (orderId: number, paymentId: number, reason: string) =>
      client.post<{ orderId: number; paymentId: number }>(e.orders.reversePayment(orderId, paymentId), { reason }),
    postUpdate: (id: number, message: string, files: File[]) =>
      client.post<{ orderId: number; updateId: number }>(e.orders.updates(id), formData({ message }, files)),
    listPayments: (params: PaymentListParams) =>
      client.get<PaymentListResponse>(e.payments.list, { ...params }),
    paymentDetail: (id: number) => client.get<PaymentDetail>(e.payments.detail(id)),
  };
}

function formData(fields: Record<string, string | undefined>, files: File[]) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== '') body.append(key, value);
  }
  for (const file of files) body.append('files', file);
  return body;
}
