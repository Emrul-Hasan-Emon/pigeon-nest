import { sellerHttp } from './http';
import { ENDPOINTS } from '../endpoints';
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
}

export function updateMyProfile(payload: MyProfilePayload) {
  const form = new FormData();
  if (payload.name !== undefined) form.set('name', payload.name);
  if (payload.email !== undefined) form.set('email', payload.email);
  if (payload.phone !== undefined) form.set('phone', payload.phone);
  if (payload.avatar) form.set('avatar', payload.avatar);
  if (payload.nidFrontImage) form.set('nidFrontImage', payload.nidFrontImage);
  if (payload.nidBackImage) form.set('nidBackImage', payload.nidBackImage);
  return sellerHttp.patch<SellerView>(ENDPOINTS.seller.profile.detail, form);
}

export function changeMyPassword(currentPassword: string, newPassword: string) {
  return sellerHttp.patch<{ updated: true }>(ENDPOINTS.seller.profile.password, {
    currentPassword,
    newPassword,
  });
}
