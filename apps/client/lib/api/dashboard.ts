import { http, sellerHttp } from './http';
import { ENDPOINTS } from '../endpoints';
import type { AdminDashboard, DashboardRange, SellerOverview } from '@/types/dashboard';

export function getAdminDashboard(range: DashboardRange) {
  return http.get<AdminDashboard>(ENDPOINTS.admin.dashboard, { range });
}

/** Only the "needs attention" counts. Cheap enough to poll for the alert bell. */
export function getAdminAttention() {
  return http.get<AdminDashboard['attention']>(ENDPOINTS.admin.dashboardAttention);
}

/** Only the to-do counts. Cheap enough to poll for the alert bell. */
export function getSellerAttention() {
  return sellerHttp.get<SellerOverview['attention']>(ENDPOINTS.seller.dashboardAttention);
}

export function getSellerOverview(range: DashboardRange) {
  return sellerHttp.get<SellerOverview>(ENDPOINTS.seller.dashboard, { range });
}
