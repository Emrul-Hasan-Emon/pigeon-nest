const USER_TOKEN_KEY = 'user_access_token';

export function getUserToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(USER_TOKEN_KEY);
}

export function setUserToken(token: string): void {
  window.localStorage.setItem(USER_TOKEN_KEY, token);
}

export function clearUserToken(): void {
  window.localStorage.removeItem(USER_TOKEN_KEY);
}
