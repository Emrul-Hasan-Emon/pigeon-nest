import { http } from './http';
import { ENDPOINTS } from '../endpoints';

export interface AdminLoginResponse {
  accessToken: string;
  admin: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
}

export function adminLogin(email: string, password: string) {
  return http.post<AdminLoginResponse>(ENDPOINTS.admin.auth.login, { email, password });
}
