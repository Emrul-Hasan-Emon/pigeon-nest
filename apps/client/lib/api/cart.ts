import { http, userHttp } from './http';
import { ENDPOINTS } from '../endpoints';
import { clearCartSession, ensureCartSession, getCartSession } from '../cart/session';
import { getUserToken } from '../auth/user-token';
import type {
  AdminCartDetail,
  AdminCartListParams,
  AdminCartListResponse,
  CartList,
  CartResult,
  CartSummary,
  SellerCartResponse,
} from '@/types/cart';

const U = ENDPOINTS.user.carts;

/** A guest needs a session before the first write; a customer does not. */
function prepareWrite() {
  if (!getUserToken()) ensureCartSession();
}

export function listMyCarts() {
  return userHttp.get<CartList>(U.list);
}
export function getCartSummary() {
  return userHttp.get<CartSummary>(U.summary);
}
export function getSellerCart(sellerId: number) {
  return userHttp.get<SellerCartResponse>(U.forSeller(sellerId));
}
export function addToCart(input: { sellerProductId: number; sellerProductSkuId?: number; quantity?: number; proposalId?: number }) {
  prepareWrite();
  return userHttp.post<CartResult>(U.items, input);
}
export function setCartItemQuantity(cartId: number, itemId: number, quantity: number) {
  prepareWrite();
  return userHttp.patch<CartResult>(U.item(cartId, itemId), { quantity });
}
export function removeCartItem(cartId: number, itemId: number) {
  prepareWrite();
  return userHttp.delete<CartResult>(U.item(cartId, itemId));
}
export function clearCart(cartId: number) {
  prepareWrite();
  return userHttp.delete<void>(U.detail(cartId));
}

/** Right after sign-in: fold the guest session's carts into the customer's own. */
export async function mergeGuestCarts(): Promise<void> {
  const sessionId = getCartSession();
  if (!sessionId) return;
  try {
    await userHttp.post<CartList>(U.merge, { sessionId });
    clearCartSession();
  } catch {
    // keep the session so a later sign-in can try again; never block signing in
  }
}

// ---- admin ----
const A = ENDPOINTS.admin.carts;

export function listAdminCarts(params: AdminCartListParams) {
  return http.get<AdminCartListResponse>(A.list, { ...params });
}
export function getAdminCart(id: number) {
  return http.get<AdminCartDetail>(A.detail(id));
}
