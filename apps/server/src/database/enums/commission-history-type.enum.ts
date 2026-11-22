export enum CommissionHistoryType {
  // Commission earned from an order that became fully paid.
  ORDER_COMMISSION = 'order_commission',
  // Money the seller handed over to the platform.
  COMMISSION_PAYMENT = 'commission_payment',
  // Commission taken back because an order, or one of its items, was returned.
  ORDER_RETURN = 'order_return',
}
