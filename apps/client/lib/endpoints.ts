// Every backend path the web app calls, grouped by who calls it: admin,
// seller or user. Paths are relative to the role's base: NEXT_PUBLIC_API_BASE_URL
// (the versioned root, e.g. .../v1/api) plus /admin, /seller or /user, added by the
// matching client in lib/api/http.ts. A path that needs an id is a function, so a missing
// id cannot build a bad address.

type Id = number | string;

/** A resource with a list/create address and one address per id. */
const resource = (base: string) => ({
  list: base,
  detail: (id: Id) => `${base}/${id}`,
});

/** Orders and payments are the same shape for the admin and a seller (the server scopes a seller's). */
const staffOrders = {
  orders: {
    list: '/orders',
    detail: (id: Id) => `/orders/${id}`,
    status: (id: Id) => `/orders/${id}/status`,
    payments: (id: Id) => `/orders/${id}/payments`,
    reversePayment: (id: Id, paymentId: Id) => `/orders/${id}/payments/${paymentId}/reverse`,
    updates: (id: Id) => `/orders/${id}/updates`,
    customers: '/orders/customers',
    customerAddresses: (userId: Id) => `/orders/customers/${userId}/addresses`,
    catalog: '/orders/catalog',
    options: '/orders/options',
  },
  payments: resource('/payments'),
} as const;

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
    sellerStatusHistory: { list: '/seller-status-history' },
    sellerRequests: {
      list: '/seller-requests',
      approve: (id: Id) => `/seller-requests/${id}/approve`,
      reject: (id: Id) => `/seller-requests/${id}/reject`,
    },

    products: {
      ...resource('/products'),
      mediaFiles: (productId: Id) => `/products/${productId}/media-files`,
    },

    productStatusHistory: { list: '/product-status-history' },

    banners: resource('/banners'),

    paymentGateways: {
      ...resource('/payment-gateways'),
      types: '/payment-gateways/types',
    },
    settings: { list: '/settings' },
    countries: { list: '/countries' },
    shippingZones: {
      ...resource('/shipping-zones'),
      quote: '/shipping-zones/quote',
    },

    homepageSections: {
      ...resource('/homepage-sections'),
      sectionTypes: '/homepage-sections/section-types',
      reorder: '/homepage-sections/reorder',
      preview: (id: Id) => `/homepage-sections/${id}/preview`,
    },
    homepageSlots: {
      ...resource('/homepage-slots'),
      preview: (id: Id) => `/homepage-slots/${id}/preview`,
    },

    carts: resource('/carts'),
    ...staffOrders,

    users: {
      ...resource('/users'),
      addresses: (userId: Id) => `/users/${userId}/addresses`,
      address: (userId: Id, id: Id) => `/users/${userId}/addresses/${id}`,
    },
    userStatusHistory: { list: '/user-status-history' },
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
    products: {
      ...resource('/products'),
      mediaFiles: (productId: Id) => `/products/${productId}/media-files`,
    },
    dashboard: '/dashboard',
    ...staffOrders,
    catalog: {
      categoryTree: '/catalog/categories/tree',
      collections: '/catalog/collections',
      attributes: '/catalog/attributes',
    },
  },

  // User-facing APIs (the customer's own account).
  user: {
    auth: {
      login: '/auth/login',
      register: '/auth/register',
    },
    profile: {
      detail: '/profile',
      password: '/profile/password',
    },
    homepage: '/homepage',
    products: {
      list: '/products',
      detail: (id: Id) => `/products/${id}`,
    },
    categories: {
      tree: '/categories/tree',
      detail: (slug: string) => `/categories/${encodeURIComponent(slug)}`,
    },
    collections: {
      list: '/collections',
      detail: (slug: string) => `/collections/${encodeURIComponent(slug)}`,
    },
    sellers: resource('/sellers'),
    addresses: resource('/addresses'),
    checkout: {
      options: (cartId: Id) => `/checkout/${cartId}`,
      place: (cartId: Id) => `/checkout/${cartId}/place`,
    },
    orders: {
      list: '/orders',
      track: '/orders/track',
      detail: (id: Id) => `/orders/${id}`,
      cancel: (id: Id) => `/orders/${id}/cancel`,
    },
    carts: {
      list: '/carts',
      summary: '/carts/summary',
      session: '/carts/session',
      merge: '/carts/merge',
      items: '/carts/items',
      forSeller: (sellerId: Id) => `/carts/seller/${sellerId}`,
      detail: (cartId: Id) => `/carts/${cartId}`,
      item: (cartId: Id, itemId: Id) => `/carts/${cartId}/items/${itemId}`,
    },
  },
} as const;
