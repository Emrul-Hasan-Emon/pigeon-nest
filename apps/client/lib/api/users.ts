import { http } from './http';
import { ENDPOINTS } from '../endpoints';
import type {
  User,
  UserListParams,
  UserListResponse,
  UserStatus,
  UserStatusHistoryParams,
  UserStatusHistoryResponse,
} from '@/types/user';

export interface UserWritePayload {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  status?: UserStatus;
  statusReason?: string;
  avatar?: File | null;
}

// The server takes multipart for create and update (avatar is optional).
function buildForm(payload: UserWritePayload): FormData {
  const form = new FormData();
  if (payload.name !== undefined) form.set('name', payload.name);
  if (payload.email !== undefined) form.set('email', payload.email);
  if (payload.phone) form.set('phone', payload.phone);
  if (payload.password) form.set('password', payload.password);
  if (payload.status !== undefined) form.set('status', payload.status);
  if (payload.statusReason) form.set('statusReason', payload.statusReason);
  if (payload.avatar) form.set('avatar', payload.avatar);
  return form;
}

export function listUsers(params: UserListParams) {
  return http.get<UserListResponse>(ENDPOINTS.admin.users.list, { ...params });
}

export function getUser(id: number) {
  return http.get<User>(ENDPOINTS.admin.users.detail(id));
}

export function createUser(payload: UserWritePayload) {
  return http.post<User>(ENDPOINTS.admin.users.list, buildForm(payload));
}

export function updateUser(id: number, payload: UserWritePayload) {
  return http.patch<User>(ENDPOINTS.admin.users.detail(id), buildForm(payload));
}

// --- status change history (admin only, read only) -------------------------

export function listUserStatusHistory(params: UserStatusHistoryParams) {
  return http.get<UserStatusHistoryResponse>(ENDPOINTS.admin.userStatusHistory.list, {
    ...params,
  });
}
