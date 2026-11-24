/**
 * Where the money for a cancelled order (or a returned item) stands.
 * needs_to_refund -> processing -> refunded. `voided` only marks a record that is no longer needed (the order was reopened).
 */
export enum RefundStatus {
  NEEDS_TO_REFUND = 'needs_to_refund',
  PROCESSING = 'processing',
  REFUNDED = 'refunded',
  VOIDED = 'voided',
}

/** What a refund record is for. */
export enum RefundKind {
  CANCELLED_ORDER = 'cancelled_order',
  RETURN = 'return',
}
