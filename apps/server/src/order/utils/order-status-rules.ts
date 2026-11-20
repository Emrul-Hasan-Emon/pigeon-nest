import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { OrderStatus } from '../../database/enums/order-status.enum';

const FORWARD: Partial<Record<OrderStatus, OrderStatus>> = {
  [OrderStatus.CONFIRMED]: OrderStatus.PACKED,
  [OrderStatus.PACKED]: OrderStatus.SHIPPED,
  [OrderStatus.SHIPPED]: OrderStatus.DELIVERED,
};

/**
 * Why `actor` may not move an order from `from` to `to`, or null when it may.
 *  - customer: cancel while pending.
 *  - seller: pending -> confirmed | cancelled, then confirmed -> packed ->
 *    shipped -> delivered. No cancelling once confirmed.
 *  - admin: any status to any other.
 */
export function transitionDenied(
  actor: AuthUserType,
  from: OrderStatus,
  to: OrderStatus,
): string | null {
  if (from === to) return `The order is already ${from}`;
  if (actor === AuthUserType.ADMIN) return null;

  if (actor === AuthUserType.USER) {
    if (to === OrderStatus.CANCELLED && from === OrderStatus.PENDING) return null;
    return to === OrderStatus.CANCELLED
      ? 'An order can only be cancelled before the seller confirms it'
      : 'Customers can only cancel an order';
  }

  // seller
  if (from === OrderStatus.PENDING && (to === OrderStatus.CONFIRMED || to === OrderStatus.CANCELLED)) {
    return null;
  }
  if (FORWARD[from] === to) return null;
  if (to === OrderStatus.CANCELLED) return 'Only an admin can cancel an order after it is confirmed';
  if (from === OrderStatus.CANCELLED) return 'Only an admin can reopen a cancelled order';
  return `A seller cannot move an order from ${from} to ${to}`;
}

/** Statuses `actor` may move an order to right now. */
export function allowedTargets(actor: AuthUserType, from: OrderStatus): OrderStatus[] {
  return Object.values(OrderStatus).filter((to) => transitionDenied(actor, from, to) === null);
}
