import { getAdminToken } from '../auth/admin-token';
import { getSellerToken } from '../auth/seller-token';
import { getUserToken } from '../auth/user-token';
import { getCartSession } from '../cart/session';

// Versioned API root, e.g. http://localhost:3100/v1/api. Each role appends
// its own segment (/admin, /seller or /user).
const API_ROOT = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/v1/api'
).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Item-by-item reasons the server sends with some conflicts (e.g. stock changed at checkout). */
    public readonly issues: string[] = [],
  ) {
    super(message);
  }
}

export class NotFoundApiError extends ApiError {}
export class ConflictApiError extends ApiError {}

function buildQuery(params?: Record<string, string | number | boolean | undefined>) {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

type Query = Record<string, string | number | boolean | undefined>;

async function request<T>(
  base: string,
  getToken: () => string | null,
  path: string,
  options: {
    method?: string;
    body?: unknown;
    query?: Query;
  } = {},
  extraHeaders?: () => Record<string, string>,
): Promise<T> {
  const { method = 'GET', body, query } = options;
  const token = getToken();

  const headers: Record<string, string> = { ...(extraHeaders?.() ?? {}) };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let requestBody: BodyInit | undefined;
  if (body instanceof FormData) {
    requestBody = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }

  const response = await fetch(`${base}${path}${buildQuery(query)}`, {
    method,
    headers,
    body: requestBody,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const message =
      (data && typeof data.message === 'string' && data.message) ||
      (Array.isArray(data?.message) && data.message.join(', ')) ||
      response.statusText;

    const issues: string[] = Array.isArray(data?.issues) ? data.issues.filter((i: unknown) => typeof i === 'string') : [];
    if (response.status === 404) {
      throw new NotFoundApiError(response.status, message, issues);
    }
    if (response.status === 409) {
      throw new ConflictApiError(response.status, message, issues);
    }
    throw new ApiError(response.status, message, issues);
  }

  return data as T;
}

function createClient(
  segment: string,
  getToken: () => string | null,
  extraHeaders?: () => Record<string, string>,
) {
  const base = `${API_ROOT}${segment}`;
  return {
    get: <T>(path: string, query?: Record<string, unknown>) =>
      request<T>(base, getToken, path, { method: 'GET', query: query as Query }, extraHeaders),
    post: <T>(path: string, body?: unknown) =>
      request<T>(base, getToken, path, { method: 'POST', body }, extraHeaders),
    put: <T>(path: string, body?: unknown) =>
      request<T>(base, getToken, path, { method: 'PUT', body }, extraHeaders),
    patch: <T>(path: string, body?: unknown) =>
      request<T>(base, getToken, path, { method: 'PATCH', body }, extraHeaders),
    delete: <T>(path: string) =>
      request<T>(base, getToken, path, { method: 'DELETE' }, extraHeaders),
  };
}

/** Admin API (`/v1/api/admin`), authenticated with the admin token. */
export const http = createClient('/admin', getAdminToken);

/** Seller API (`/v1/api/seller`), authenticated with the seller token. */
export const sellerHttp = createClient('/seller', getSellerToken);

/** User API (`/v1/api/user`), authenticated with the user token. */
export const userHttp = createClient('/user', getUserToken, (): Record<string, string> => {
  // A guest's cart is identified by this header; a signed-in customer needs none.
  const session = getUserToken() ? null : getCartSession();
  return session ? { 'x-cart-session': session } : {};
});
