import { userHttp } from './http';
import { ENDPOINTS } from '../endpoints';
import { setUserToken } from '../auth/user-token';
import type { UserLoginResponse, UserView } from '@/types/user';

export function userLogin(phone: string, password: string) {
  return userHttp.post<UserLoginResponse>(ENDPOINTS.user.auth.login, { phone, password });
}

export interface UserRegisterPayload {
  name: string;
  phone: string;
  password: string;
  email?: string;
}

export function userRegister(payload: UserRegisterPayload) {
  return userHttp.post<UserLoginResponse>(ENDPOINTS.user.auth.register, payload);
}

export function getMyUserProfile() {
  return userHttp.get<UserView>(ENDPOINTS.user.profile.detail);
}

export interface MyUserProfilePayload {
  name?: string;
  email?: string;
  phone?: string;
  avatar?: File | null;
}

export function updateMyUserProfile(payload: MyUserProfilePayload) {
  const form = new FormData();
  if (payload.name !== undefined) form.set('name', payload.name);
  if (payload.email !== undefined) form.set('email', payload.email);
  if (payload.phone !== undefined) form.set('phone', payload.phone);
  if (payload.avatar) form.set('avatar', payload.avatar);
  return userHttp.patch<UserView>(ENDPOINTS.user.profile.detail, form);
}

// The old token stops working with the old password, so keep the fresh one the server returns.
export async function changeMyUserPassword(currentPassword: string, newPassword: string) {
  const result = await userHttp.patch<{ updated: true; accessToken: string }>(ENDPOINTS.user.profile.password, {
    currentPassword,
    newPassword,
  });
  setUserToken(result.accessToken);
  return result;
}
