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
    list: '/order',
    detail: (id: Id) => `/order/${id}`,
    status: (id: Id) => `/order/${id}/status`,
    payments: (id: Id) => `/order/${id}/payments`,
    reversePayment: (id: Id, paymentId: Id) => `/order/${id}/payments/${paymentId}/reverse`,
    updates: (id: Id) => `/order/${id}/updates`,
    customers: '/order/customers',
    customerAddresses: (userId: Id) => `/order/customers/${userId}/addresses`,
    catalog: '/order/catalog',
    options: '/order/options',
  },
  payments: resource('/order/payments'),
} as const;

export const ENDPOINTS = {
  admin: {
    dashboard: '/dashboard',
    dashboardAttention: '/dashboard/attention',
    auth: {
      login: '/auth/login',
      me: '/auth/me',
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
      parent: (productId: Id, skuId: Id, role: string) => `/products/${productId}/skus/${skuId}/parents/${role}`,
    },

    productStatusHistory: { list: '/product-status-history' },

    banners: resource('/banners'),

    paymentGateways: {
      ...resource('/payment-gateways'),
      types: '/payment-gateways/types',
    },
    settings: { list: '/settings' },
    commission: {
      balances: '/commission/balances',
      balance: (sellerId: Id) => `/commission/balances/${sellerId}`,
      disburse: (sellerId: Id) => `/commission/balances/${sellerId}/disbursements`,
      history: '/commission/history',
      changes: '/commission/changes',
      disbursements: resource('/commission/disbursements'),
      rule: (sellerId: Id) => `/commission/sellers/${sellerId}/setting`,
      settingHistory: '/commission/settings/history',
    },
    countries: { list: '/countries' },
    shippingZones: {
      ...resource('/shipping-zones'),
      quote: '/shipping-zones/quote',
    },

    homepageSections: {
      ...resource('/homepage/sections'),
      sectionTypes: '/homepage/sections/section-types',
      reorder: '/homepage/sections/reorder',
      preview: (id: Id) => `/homepage/sections/${id}/preview`,
    },
    homepageSlots: {
      ...resource('/homepage/slots'),
      preview: (id: Id) => `/homepage/slots/${id}/preview`,
    },

    carts: resource('/carts'),
    wishlist: { list: '/wishlist', mostSaved: '/wishlist/most-saved' },
    returns: {
      list: '/returns',
      create: '/returns',
      eligibility: (orderId: Id) => `/returns/eligibility/${orderId}`,
      detail: (id: Id) => `/returns/${id}`,
      status: (id: Id) => `/returns/${id}/status`,
    },
    proposals: {
      list: '/proposals',
      detail: (id: Id) => `/proposals/${id}`,
      reject: (id: Id) => `/proposals/${id}/reject`,
      cancel: (id: Id) => `/proposals/${id}/cancel`,
    },
    reviews: {
      list: '/reviews',
      detail: (id: Id) => `/reviews/${id}`,
      hide: (id: Id) => `/reviews/${id}/hide`,
      restore: (id: Id) => `/reviews/${id}/restore`,
      replies: (id: Id) => `/reviews/${id}/replies`,
    },
    reviewReplies: {
      one: (id: Id) => `/review-replies/${id}`,
      hide: (id: Id) => `/review-replies/${id}/hide`,
      restore: (id: Id) => `/review-replies/${id}/restore`,
    },
    reviewReports: { list: '/review-reports', resolve: (id: Id) => `/review-reports/${id}/resolve` },
    ...staffOrders,

    users: {
      ...resource('/users'),
      addresses: (userId: Id) => `/users/${userId}/addresses`,
      address: (userId: Id, id: Id) => `/users/${userId}/addresses/${id}`,
      wishlist: (userId: Id) => `/users/${userId}/wishlist`,
      reviews: (userId: Id) => `/users/${userId}/reviews`,
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
      parent: (productId: Id, skuId: Id, role: string) => `/products/${productId}/skus/${skuId}/parents/${role}`,
    },
    dashboard: '/dashboard',
    dashboardAttention: '/dashboard/attention',
    wishlist: { insights: '/wishlist/insights' },
    returns: {
      list: '/returns',
      detail: (id: Id) => `/returns/${id}`,
      accept: (id: Id) => `/returns/${id}/accept`,
      reject: (id: Id) => `/returns/${id}/reject`,
      processing: (id: Id) => `/returns/${id}/processing`,
      returningMoney: (id: Id) => `/returns/${id}/returning-money`,
    },
    proposals: {
      list: '/proposals',
      summary: '/proposals/summary',
      detail: (id: Id) => `/proposals/${id}`,
      accept: (id: Id) => `/proposals/${id}/accept`,
      counter: (id: Id) => `/proposals/${id}/counter`,
      reject: (id: Id) => `/proposals/${id}/reject`,
    },
    reviews: {
      list: '/reviews',
      summary: '/reviews/summary',
      replies: (id: Id) => `/reviews/${id}/replies`,
      report: (id: Id) => `/reviews/${id}/report`,
    },
    reviewReplies: { one: (id: Id) => `/review-replies/${id}`, report: (id: Id) => `/review-replies/${id}/report` },
    commission: {
      balance: '/commission/balance',
      history: '/commission/history',
      changes: '/commission/changes',
      disbursements: resource('/commission/disbursements'),
      rule: '/commission/setting',
      settingHistory: '/commission/setting/history',
    },
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
      options: (cartId: Id) => `/order/checkout/${cartId}`,
      place: (cartId: Id) => `/order/checkout/${cartId}/place`,
    },
    orders: {
      list: '/order',
      track: '/order/track',
      detail: (id: Id) => `/order/${id}`,
      cancel: (id: Id) => `/order/${id}/cancel`,
    },
    returns: {
      list: '/returns',
      create: '/returns',
      eligibility: (orderId: Id) => `/returns/eligibility/${orderId}`,
      detail: (id: Id) => `/returns/${id}`,
      cancel: (id: Id) => `/returns/${id}/cancel`,
    },
    reviews: {
      productSummary: (productId: Id) => `/products/${productId}/reviews/summary`,
      productList: (productId: Id) => `/products/${productId}/reviews`,
      sellerList: (sellerId: Id) => `/sellers/${sellerId}/reviews`,
      thread: (id: Id) => `/reviews/${id}/replies`,
      list: '/reviews',
      pending: '/reviews/pending',
      votes: '/reviews/votes',
      one: (id: Id) => `/reviews/${id}`,
      helpful: (id: Id) => `/reviews/${id}/helpful`,
      report: (id: Id) => `/reviews/${id}/report`,
      reply: (id: Id) => `/reviews/${id}/replies`,
    },
    reviewReplies: { one: (id: Id) => `/review-replies/${id}`, report: (id: Id) => `/review-replies/${id}/report` },
    proposals: {
      list: '/proposals',
      create: '/proposals',
      forSku: (skuId: Id) => `/proposals/sku/${skuId}`,
      detail: (id: Id) => `/proposals/${id}`,
      accept: (id: Id) => `/proposals/${id}/accept`,
      counter: (id: Id) => `/proposals/${id}/counter`,
      reject: (id: Id) => `/proposals/${id}/reject`,
      cancel: (id: Id) => `/proposals/${id}/cancel`,
    },
    wishlist: {
      list: '/wishlist',
      ids: '/wishlist/ids',
      item: (productId: Id) => `/wishlist/${productId}`,
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
