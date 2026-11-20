import { http } from './http';
import { ENDPOINTS } from '../endpoints';
import type { Banner, BannerListParams, BannerListResponse, BannerPosition } from '@/types/banner';

export interface BannerWritePayload {
  title?: string;
  position?: BannerPosition;
  linkUrl?: string;
  startsAt?: string;
  endsAt?: string;
  sortOrder?: number;
  isActive?: boolean;
  image?: File | null;
  mobileImage?: File | null;
  removeMobileImage?: boolean;
}

// Banners are always multipart (the image is a file).
function buildForm(payload: BannerWritePayload): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;
    if (value instanceof File) form.set(key, value);
    else form.set(key, String(value));
  }
  return form;
}

export function listBanners(params: BannerListParams) {
  return http.get<BannerListResponse>(ENDPOINTS.admin.banners.list, { ...params });
}

export function getBanner(id: number) {
  return http.get<Banner>(ENDPOINTS.admin.banners.detail(id));
}

export function createBanner(payload: BannerWritePayload) {
  return http.post<Banner>(ENDPOINTS.admin.banners.list, buildForm(payload));
}

export function updateBanner(id: number, payload: BannerWritePayload) {
  return http.patch<Banner>(ENDPOINTS.admin.banners.detail(id), buildForm(payload));
}

export function deleteBanner(id: number) {
  return http.delete<void>(ENDPOINTS.admin.banners.detail(id));
}
