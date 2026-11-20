const KEY = 'cart_session';

export function getCartSession(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** The guest's cart session id, created the first time a guest adds something. */
export function ensureCartSession(): string {
  const existing = getCartSession();
  if (existing) return existing;
  const id = crypto.randomUUID().replace(/-/g, '');
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    // storage blocked: the cart works for this page load only
  }
  return id;
}

export function clearCartSession(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
