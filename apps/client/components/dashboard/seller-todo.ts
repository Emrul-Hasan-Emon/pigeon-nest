import type { SellerOverview } from '@/types/dashboard';
import type { TodoItem } from './parts';

/** The seller's "to do" lines. The dashboard and the alert bell show the same list. */
export function sellerTodoItems(a: SellerOverview['attention']): TodoItem[] {
  return [
    { label: 'Orders to confirm', count: a.ordersToConfirm, href: '/seller/orders' },
    { label: 'Orders to pack', count: a.ordersToPack, href: '/seller/orders' },
    { label: 'Orders to ship', count: a.ordersToShip, href: '/seller/orders' },
    { label: 'Return requests', count: a.returnRequests, href: '/seller/returns', tone: 'bad' },
    { label: 'Returns in progress', count: a.returnsInProgress, href: '/seller/returns' },
    { label: 'Price offers to answer', count: a.offersWaiting, href: '/seller/offers' },
    { label: 'SKUs out of stock', count: a.outOfStockSkus, href: '/seller/products', tone: 'bad' },
    { label: `SKUs with ${a.lowStockAt} or fewer left`, count: a.lowStockSkus, href: '/seller/products' },
    { label: 'Refunds to send back', count: a.refundsToSend ?? 0, href: '/seller/refunds', tone: 'bad' },
    { label: 'Mark as paid requests to check', count: a.paymentClaims ?? 0, href: '/seller/payment-claims', tone: 'bad' },
    { label: 'Questions to answer', count: a.questionsToAnswer ?? 0, href: '/seller/questions' },
    { label: 'Reviews without a reply', count: a.reviewsUnanswered, href: '/seller/reviews' },
    { label: 'Products waiting for approval', count: a.productsPending, href: '/seller/products' },
  ];
}
