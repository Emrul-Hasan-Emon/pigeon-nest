import { http } from './http';
import { ENDPOINTS } from '../endpoints';
import type {
  Seller,
  SellerListParams,
  SellerListResponse,
  SellerActiveStatus,
  SellerStatus,
  SellerStatusHistoryParams,
  SellerStatusHistoryResponse,
} from '@/types/seller';

export interface SellerWritePayload {
  name?: string;
  email?: string | null;
  phone?: string | null;
  password?: string;
  /** Send both to set or change the seller's own commission. */
  commissionType?: 'percentage' | 'fixed';
  commissionAmount?: number;
  status?: SellerStatus;
  activeStatus?: SellerActiveStatus;
  /** Note for the status history; required when rejecting or suspending. */
  reason?: string;
  avatar?: File | null;
  nidFrontImage?: File | null;
  nidBackImage?: File | null;
}

function buildBody(payload: SellerWritePayload): FormData | Record<string, unknown> {
  if (payload.avatar || payload.nidFrontImage || payload.nidBackImage) {
    const form = new FormData();
    if (payload.name !== undefined) form.set('name', payload.name);
    if (payload.email) form.set('email', payload.email);
    if (payload.phone) form.set('phone', payload.phone);
    if (payload.password) form.set('password', payload.password);
    if (payload.commissionType !== undefined && payload.commissionAmount !== undefined) {
      form.set('commissionType', payload.commissionType);
      form.set('commissionAmount', String(payload.commissionAmount));
    }
    if (payload.status !== undefined) form.set('status', payload.status);
    if (payload.activeStatus !== undefined) form.set('activeStatus', payload.activeStatus);
    if (payload.reason !== undefined) form.set('reason', payload.reason);
    if (payload.avatar) form.set('avatar', payload.avatar);
    if (payload.nidFrontImage) form.set('nidFrontImage', payload.nidFrontImage);
    if (payload.nidBackImage) form.set('nidBackImage', payload.nidBackImage);
    return form;
  }

  const json: Record<string, unknown> = {};
  if (payload.name !== undefined) json.name = payload.name;
  if (payload.email) json.email = payload.email;
  if (payload.phone) json.phone = payload.phone;
  if (payload.password) json.password = payload.password;
  if (payload.commissionType !== undefined && payload.commissionAmount !== undefined) {
    json.commissionType = payload.commissionType;
    json.commissionAmount = payload.commissionAmount;
  }
  if (payload.status !== undefined) json.status = payload.status;
  if (payload.activeStatus !== undefined) json.activeStatus = payload.activeStatus;
  if (payload.reason !== undefined) json.reason = payload.reason;
  return json;
}

export function listSellers(params: SellerListParams) {
  return http.get<SellerListResponse>(ENDPOINTS.admin.sellers.list, { ...params });
}

export function getSeller(id: number) {
  return http.get<Seller>(ENDPOINTS.admin.sellers.detail(id));
}

export function createSeller(payload: SellerWritePayload) {
  return http.post<Seller>(ENDPOINTS.admin.sellers.list, buildBody(payload));
}

export function updateSeller(id: number, payload: SellerWritePayload) {
  return http.patch<Seller>(ENDPOINTS.admin.sellers.detail(id), buildBody(payload));
}

// --- pending registration requests -----------------------------------------

export function listSellerRequests(params: { search?: string; cursor?: number; limit?: number }) {
  return http.get<SellerListResponse>(ENDPOINTS.admin.sellerRequests.list, { ...params });
}

export function approveSellerRequest(id: number) {
  return http.post<Seller>(ENDPOINTS.admin.sellerRequests.approve(id));
}

export function rejectSellerRequest(id: number, reason: string) {
  return http.post<Seller>(ENDPOINTS.admin.sellerRequests.reject(id), { reason });
}

// --- status change history (admin only, read only) -------------------------

export function listSellerStatusHistory(params: SellerStatusHistoryParams) {
  return http.get<SellerStatusHistoryResponse>(ENDPOINTS.admin.sellerStatusHistory.list, {
    ...params,
  });
}
