// Why a commission row or balance change was written.
export enum CommissionStatus {
  // Commission earned by the system from a paid order.
  FOR_SYSTEM = 'for_system',
  // Commission taken back because the order (or an item) was returned to the customer.
  ORDER_RETURNED_TO_CUSTOMER = 'order_returned_to_customer',
  // The seller handed commission over.
  COMMISSION_PAYMENT = 'commission_payment',
  // An order's commission was voided (payment reversed, order cancelled).
  COMMISSION_VOIDED = 'commission_voided',
  // A finished return was undone by an admin, so the commission is earned again.
  RETURN_UNDONE = 'return_undone',
}
