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

export interface AdminMe {
  id: number;
  name: string;
  email: string;
  role: string;
  imageUrl: string | null;
}

/** Who is signed in. */
export function getAdminMe() {
  return http.get<AdminMe>(ENDPOINTS.admin.auth.me);
}

export function adminLogin(email: string, password: string) {
  return http.post<AdminLoginResponse>(ENDPOINTS.admin.auth.login, { email, password });
}
