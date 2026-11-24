import { http, sellerHttp, userHttp } from './http';
import { ENDPOINTS } from '../endpoints';
import type {
  AdminWishlistParams,
  AdminWishlistRow,
  MostSavedProduct,
  SellerWishlistInsights,
  WishlistAck,
  WishlistIds,
  WishlistItem,
  WishlistListParams,
  WishlistPage,
} from '@/types/wishlist';

const U = ENDPOINTS.user.wishlist;

// ---- customer ----
export function listMyWishlist(params: WishlistListParams) {
  return userHttp.get<WishlistPage<WishlistItem>>(U.list, { ...params });
}
export function getWishlistIds() {
  return userHttp.get<WishlistIds>(U.ids);
}
export function saveToWishlist(productId: number) {
  return userHttp.post<WishlistAck>(U.item(productId));
}
export function removeFromWishlist(productId: number) {
  return userHttp.delete<WishlistAck>(U.item(productId));
}

// ---- seller ----
export function getWishlistInsights(limit?: number, search?: string) {
  return sellerHttp.get<SellerWishlistInsights>(ENDPOINTS.seller.wishlist.insights, { limit, search });
}

// ---- admin ----
const A = ENDPOINTS.admin.wishlist;

export function listAdminWishlist(params: AdminWishlistParams) {
  return http.get<WishlistPage<AdminWishlistRow>>(A.list, { ...params });
}
export function listUserWishlist(userId: number, params: AdminWishlistParams) {
  return http.get<WishlistPage<AdminWishlistRow>>(ENDPOINTS.admin.users.wishlist(userId), { ...params });
}
export function listMostSaved(params: { sellerId?: number; categoryId?: number; limit?: number }) {
  return http.get<MostSavedProduct[]>(A.mostSaved, { ...params });
}
