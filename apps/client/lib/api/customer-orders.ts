import { userHttp } from './http';
import { ENDPOINTS } from '../endpoints';
import type {
  Cart,
} from '@/types/cart';
import type {
  DeliveryOption,
  DeliveryType,
  GatewayOption,
  OrderDetail,
  OrderStatus,
  OrderSummary,
  PaymentStatus,
} from '@/types/order';

const C = ENDPOINTS.user.checkout;
const O = ENDPOINTS.user.orders;

export interface CheckoutOptions {
  cart: Cart;
  countryCode: string | null;
  countryName: string | null;
  deliveryOptions: DeliveryOption[];
  paymentGateways: GatewayOption[];
}

export interface PlaceOrderInput {
  recipientName: string;
  recipientPhone: string;
  contactEmail?: string;
  countryCode: string;
  state?: string;
  city: string;
  addressLine: string;
  postalCode?: string;
  deliveryType: DeliveryType;
  paymentGatewayId: number;
  note?: string;
  paymentProof?: Record<string, string>;
}

/** An order as a customer sees it: no seller-only fields, only their own moves. */
export type MyOrder = OrderDetail;

export interface MyOrderPage {
  results: OrderSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function getCheckoutOptions(cartId: number, countryCode?: string) {
  return userHttp.get<CheckoutOptions>(C.options(cartId), countryCode ? { countryCode } : undefined);
}
export function placeOrder(cartId: number, input: PlaceOrderInput) {
  return userHttp.post<MyOrder>(C.place(cartId), input);
}
export function listMyOrders(params: { page?: number; pageSize?: number; status?: OrderStatus; paymentStatus?: PaymentStatus; search?: string }) {
  return userHttp.get<MyOrderPage>(O.list, { ...params });
}
export function getMyOrder(id: number) {
  return userHttp.get<MyOrder>(O.detail(id));
}
export function cancelMyOrder(id: number, reason?: string) {
  return userHttp.post<MyOrder>(O.cancel(id), reason ? { reason } : {});
}
export function trackOrder(orderNumber: string, phone: string) {
  return userHttp.get<MyOrder>(O.track, { orderNumber, phone });
}
