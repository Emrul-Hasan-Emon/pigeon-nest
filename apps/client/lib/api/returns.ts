import { http, sellerHttp, userHttp } from './http';
import { ENDPOINTS } from '../endpoints';
import type {
  CreateReturnInput,
  ReturnDetail,
  ReturnEligibility,
  ReturnListParams,
  ReturnPage,
  ReturnStatus,
} from '@/types/returns';

function createForm(input: CreateReturnInput) {
  const form = new FormData();
  form.append('orderId', String(input.orderId));
  form.append('scope', input.scope);
  if (input.orderItemIds?.length) form.append('orderItemIds', input.orderItemIds.join(','));
  form.append('reason', input.reason);
  if (input.includeDeliveryCharge !== undefined) form.append('includeDeliveryCharge', String(input.includeDeliveryCharge));
  for (const f of input.files ?? []) form.append('files', f);
  return form;
}

function noteForm(fields: Record<string, string | boolean | undefined>, files: File[] = []) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== '') form.append(k, String(v));
  for (const f of files) form.append('files', f);
  return form;
}

// ---- customer ----
const U = ENDPOINTS.user.returns;

export const listMyReturns = (params: ReturnListParams) => userHttp.get<ReturnPage>(U.list, { ...params });
export const getMyReturn = (id: number) => userHttp.get<ReturnDetail>(U.detail(id));
export const getMyReturnEligibility = (orderId: number) => userHttp.get<ReturnEligibility>(U.eligibility(orderId));
export const createMyReturn = (input: CreateReturnInput) => userHttp.post<ReturnDetail>(U.create, createForm(input));
export const cancelMyReturn = (id: number, note?: string) => userHttp.post<ReturnDetail>(U.cancel(id), note ? { note } : {});

// ---- seller ----
const S = ENDPOINTS.seller.returns;

export const listSellerReturns = (params: ReturnListParams) => sellerHttp.get<ReturnPage>(S.list, { ...params });
export const getSellerReturn = (id: number) => sellerHttp.get<ReturnDetail>(S.detail(id));
export const sellerAcceptReturn = (id: number, input: { note?: string; includeDeliveryCharge?: boolean } = {}) =>
  sellerHttp.post<ReturnDetail>(S.accept(id), input);
export const sellerRejectReturn = (id: number, note: string) => sellerHttp.post<ReturnDetail>(S.reject(id), { note });
export const sellerProcessReturn = (id: number, note?: string) =>
  sellerHttp.post<ReturnDetail>(S.processing(id), note ? { note } : {});
export const sellerReturnMoney = (id: number, note: string, files: File[]) =>
  sellerHttp.post<ReturnDetail>(S.returningMoney(id), noteForm({ note }, files));

// ---- admin ----
const A = ENDPOINTS.admin.returns;

export const listAdminReturns = (params: ReturnListParams) => http.get<ReturnPage>(A.list, { ...params });
export const getAdminReturn = (id: number) => http.get<ReturnDetail>(A.detail(id));
export const getAdminReturnEligibility = (orderId: number) => http.get<ReturnEligibility>(A.eligibility(orderId));
export const adminCreateReturn = (input: CreateReturnInput) => http.post<ReturnDetail>(A.create, createForm(input));
export const adminSetReturnStatus = (
  id: number,
  input: { status: ReturnStatus; note: string; includeDeliveryCharge?: boolean },
  files: File[] = [],
) => http.post<ReturnDetail>(A.status(id), noteForm({ ...input }, files));
