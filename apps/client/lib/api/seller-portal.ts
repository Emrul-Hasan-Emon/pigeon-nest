import { sellerHttp } from './http';
import { ENDPOINTS } from '../endpoints';
import { setSellerToken } from '../auth/seller-token';
import type { SellerLoginResponse, SellerView } from '@/types/seller';

export function sellerLogin(phone: string, password: string) {
  return sellerHttp.post<SellerLoginResponse>(ENDPOINTS.seller.auth.login, { phone, password });
}

export interface SellerRegisterPayload {
  name: string;
  phone: string;
  password: string;
  email?: string;
  avatar?: File | null;
  nidFrontImage?: File | null;
  nidBackImage?: File | null;
}

export function sellerRegister(payload: SellerRegisterPayload) {
  const form = new FormData();
  form.set('name', payload.name);
  form.set('phone', payload.phone);
  form.set('password', payload.password);
  if (payload.email) form.set('email', payload.email);
  if (payload.avatar) form.set('avatar', payload.avatar);
  if (payload.nidFrontImage) form.set('nidFrontImage', payload.nidFrontImage);
  if (payload.nidBackImage) form.set('nidBackImage', payload.nidBackImage);
  return sellerHttp.post<SellerLoginResponse>(ENDPOINTS.seller.auth.register, form);
}

export function getMyProfile() {
  return sellerHttp.get<SellerView>(ENDPOINTS.seller.profile.detail);
}

export interface MyProfilePayload {
  name?: string;
  email?: string;
  phone?: string;
  avatar?: File | null;
  nidFrontImage?: File | null;
  nidBackImage?: File | null;
  /** Blank clears it. */
  description?: string;
}

/** The selling switch and a planned break. Blank dates and note are cleared. */
export function setSelling(payload: { isEnabledForSell: boolean; breakStartsOn?: string; breakEndsOn?: string; note?: string }) {
  return sellerHttp.patch<SellerView>(`${ENDPOINTS.seller.profile.detail}/selling`, payload);
}

export function updateMyProfile(payload: MyProfilePayload) {
  const form = new FormData();
  if (payload.name !== undefined) form.set('name', payload.name);
  if (payload.email !== undefined) form.set('email', payload.email);
  if (payload.phone !== undefined) form.set('phone', payload.phone);
  if (payload.description !== undefined) form.set('description', payload.description);
  if (payload.avatar) form.set('avatar', payload.avatar);
  if (payload.nidFrontImage) form.set('nidFrontImage', payload.nidFrontImage);
  if (payload.nidBackImage) form.set('nidBackImage', payload.nidBackImage);
  return sellerHttp.patch<SellerView>(ENDPOINTS.seller.profile.detail, form);
}

// The old token stops working with the old password, so keep the fresh one the server returns.
export async function changeMyPassword(currentPassword: string, newPassword: string) {
  const result = await sellerHttp.patch<{ updated: true; accessToken: string }>(ENDPOINTS.seller.profile.password, {
    currentPassword,
    newPassword,
  });
  setSellerToken(result.accessToken);
  return result;
}
