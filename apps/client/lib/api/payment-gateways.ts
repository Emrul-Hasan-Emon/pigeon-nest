import { http } from './http';
import { ENDPOINTS } from '../endpoints';
import type {
  GatewayListParams,
  GatewayListResponse,
  GatewayType,
  GatewayTypeRule,
  PaymentGateway,
} from '@/types/payment-gateway';

export interface GatewayWritePayload {
  name?: string;
  type?: GatewayType;
  description?: string;
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  branchName?: string;
  isActive?: boolean;
  icon?: File | null;
  removeIcon?: boolean;
}

// Always multipart: the icon is a file. A blank string clears a text field on update.
function buildForm(payload: GatewayWritePayload): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;
    if (value instanceof File) form.set(key, value);
    else form.set(key, String(value));
  }
  return form;
}

export function listGateways(params: GatewayListParams) {
  return http.get<GatewayListResponse>(ENDPOINTS.admin.paymentGateways.list, { ...params });
}
export function getGateway(id: number) {
  return http.get<PaymentGateway>(ENDPOINTS.admin.paymentGateways.detail(id));
}
export function listGatewayTypes() {
  return http.get<GatewayTypeRule[]>(ENDPOINTS.admin.paymentGateways.types);
}
export function createGateway(payload: GatewayWritePayload) {
  return http.post<PaymentGateway>(ENDPOINTS.admin.paymentGateways.list, buildForm(payload));
}
export function updateGateway(id: number, payload: GatewayWritePayload) {
  return http.patch<PaymentGateway>(ENDPOINTS.admin.paymentGateways.detail(id), buildForm(payload));
}
export function deleteGateway(id: number) {
  return http.delete<void>(ENDPOINTS.admin.paymentGateways.detail(id));
}
