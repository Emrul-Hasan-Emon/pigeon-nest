/** A buyer's "I have paid" message about an order: waiting for the seller (or admin) to check it. */
export enum PaymentClaimStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

/** Where a seller takes payment: a online wallet number (PayPal, Wise...) or a bank account. */
export enum PaymentAccountKind {
  MFS = 'mfs',
  BANK = 'bank',
}
