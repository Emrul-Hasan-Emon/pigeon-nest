import type { AdminDashboard } from '@/types/dashboard';
import type { TodoItem } from './parts';

/** The admin's "needs attention" lines. The dashboard and the alert bell show the same list. */
export function adminTodoItems(a: AdminDashboard['attention']): TodoItem[] {
  return [
    { label: 'Sellers waiting for approval', count: a.pendingSellers, href: '/admin/sellers/requests' },
    { label: 'Products waiting for review', count: a.pendingProducts, href: '/admin/catalog/products' },
    { label: 'Return requests', count: a.returnRequests, href: '/admin/returns' },
    { label: 'Returns in progress', count: a.returnsInProgress, href: '/admin/returns' },
    { label: 'Delivered, not fully paid', count: a.deliveredUnpaid, href: '/admin/orders', tone: 'bad' },
    { label: 'Reported reviews', count: a.reviewReports, href: '/admin/reviews/reports' },
  ];
}

export const attentionTotal = (a: AdminDashboard['attention']) => adminTodoItems(a).reduce((n, i) => n + i.count, 0);
