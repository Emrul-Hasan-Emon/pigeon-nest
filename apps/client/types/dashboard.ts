export type DashboardRange = '7d' | '30d' | '90d' | '12m';

export interface DashboardChange {
  orders: number | null;
  paidOrders: number | null;
  grossSales: number | null;
  netSales: number | null;
  averageOrder: number | null;
  netCommission: number | null;
  sellerEarnings: number | null;
}

export interface DashboardTotals {
  orders: { placed: number; paid: number; delivered: number; cancelled: number };
  grossSales: number;
  refunds: { count: number; amount: number };
  netSales: number;
  averageOrder: number;
  commission: { earned: number; returned: number; net: number };
  sellerEarnings: number;
  returnRate: number;
  change: DashboardChange;
}

export interface DashboardPoint {
  date: string;
  orders: number;
  paidOrders: number;
  grossSales: number;
  refunds: number;
  netSales: number;
}

export interface DashboardStatusCount {
  status: string;
  count: number;
}

export interface DashboardTopProduct {
  id: number;
  name: string;
  units: number;
  revenue: number;
}

export interface DashboardBase {
  range: DashboardRange;
  from: string;
  to: string;
  bucket: 'day' | 'month';
  totals: DashboardTotals;
  series: DashboardPoint[];
  ordersByStatus: DashboardStatusCount[];
  topProducts: DashboardTopProduct[];
}

export interface AdminDashboard extends DashboardBase {
  topSellers: { id: number; name: string; orders: number; grossSales: number; commission: number }[];
  people: { newCustomers: number; customers: number; newSellers: number; sellers: number; activeSellers: number; liveProducts: number };
  attention: {
    pendingSellers: number;
    pendingProducts: number;
    deliveredUnpaid: number;
    reviewReports: number;
    returnRequests: number;
    returnsInProgress: number;
  };
  balances: { total: number; due: number; paid: number; sellersOwing: number };
}

import type { SellerWishlistInsights } from './wishlist';

export interface SellerProductCounts {
  totalProducts: number;
  status: { approved: number; pending: number; rejected: number };
  activeStatus: { active: number; inactive: number; suspended: number };
  /** Approved and active: shown on the storefront. */
  visibleProducts: number;
  /** Rejected or suspended by an admin: the seller cannot change them. */
  lockedProducts: number;
  totalSkus: number;
  outOfStockSkus: number;
}

export interface SellerOverview extends DashboardBase {
  attention: {
    ordersToConfirm: number;
    ordersToPack: number;
    ordersToShip: number;
    ordersOnTheWay: number;
    returnRequests: number;
    returnsInProgress: number;
    offersWaiting: number;
    outOfStockSkus: number;
    lowStockSkus: number;
    lowStockAt: number;
    productsPending: number;
    reviewsUnanswered: number;
    questionsToAnswer: number;
    paymentClaims: number;
    refundsToSend: number;
  };
  balance: { total: number; due: number; paid: number };
  reviews: { count: number; average: number | null };
  products: SellerProductCounts;
  wishlist: SellerWishlistInsights;
}
