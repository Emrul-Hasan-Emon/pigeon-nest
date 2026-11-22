export enum ReturnStatus {
  // Asked for by the customer (or by an admin for them). The customer may still cancel.
  RETURN_REQUESTED = 'return_requested',
  // The seller agreed; rejection needs a note.
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  // The seller is dealing with the returned goods.
  PROCESSING = 'processing',
  // The seller is paying the money back, with proof.
  RETURNING_MONEY = 'returning_money',
  // An admin confirmed the money went back. Commission is taken back at this point.
  RETURNED = 'returned',
  // The customer (or an admin) withdrew the request while it was still only requested.
  CANCELLED = 'cancelled',
}

/** Statuses where the return is still open and covers its items. */
export const OPEN_RETURN_STATUSES = [
  ReturnStatus.RETURN_REQUESTED,
  ReturnStatus.ACCEPTED,
  ReturnStatus.PROCESSING,
  ReturnStatus.RETURNING_MONEY,
];
