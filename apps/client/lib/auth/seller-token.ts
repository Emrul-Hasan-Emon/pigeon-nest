const SELLER_TOKEN_KEY = 'seller_access_token';

export function getSellerToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(SELLER_TOKEN_KEY);
}

export function setSellerToken(token: string): void {
  window.localStorage.setItem(SELLER_TOKEN_KEY, token);
}

export function clearSellerToken(): void {
  window.localStorage.removeItem(SELLER_TOKEN_KEY);
}
