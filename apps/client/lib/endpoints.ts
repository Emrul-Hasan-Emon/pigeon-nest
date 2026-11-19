// Every backend path the web app calls, grouped by who calls it: admin,
// seller or user. Paths are relative to the role's base: NEXT_PUBLIC_API_BASE_URL
// (the versioned root, e.g. .../v1/api) plus /admin or /seller, added by the
// matching client in lib/api/http.ts. A path that needs an id is a function, so a missing
// id cannot build a bad address.

type Id = number | string;

/** A resource with a list/create address and one address per id. */
const resource = (base: string) => ({
  list: base,
  detail: (id: Id) => `${base}/${id}`,
});

export const ENDPOINTS = {
  admin: {
    auth: {
      login: '/auth/login',
    },

    categories: {
      ...resource('/categories'),
      tree: '/categories/tree',
      parentChain: '/categories/parent-chain',
    },

    collections: resource('/collections'),

    attributes: {
      ...resource('/attributes'),
      values: (attributeId: Id) => `/attributes/${attributeId}/values`,
    },
    attributeValues: resource('/attribute-values'),

    sellers: resource('/sellers'),
    sellerRequests: {
      list: '/seller-requests',
      approve: (id: Id) => `/seller-requests/${id}/approve`,
      reject: (id: Id) => `/seller-requests/${id}/reject`,
    },

    products: {
      ...resource('/products'),
      mediaFiles: (productId: Id) => `/products/${productId}/media-files`,
    },
  },

  // Seller-facing APIs (the seller's own portal).
  seller: {
    auth: {
      login: '/auth/login',
      register: '/auth/register',
    },
    profile: {
      detail: '/profile',
      password: '/profile/password',
    },
  },

  // Buyer/user-facing storefront APIs — none built yet.
  user: {},
} as const;
