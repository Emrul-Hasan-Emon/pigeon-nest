// Why a seller's status / activeStatus row was written to the history log.
export enum SellerStatusChangeAction {
  // Starting point recorded for sellers that existed before history tracking.
  BASELINE = 'baseline',
  // The seller registered themselves (pending + inactive).
  REGISTERED = 'registered',
  // An admin created the seller (approved + active).
  ADMIN_CREATED = 'admin_created',
  // An admin approved a pending registration.
  APPROVED = 'approved',
  // An admin rejected a pending registration.
  REJECTED = 'rejected',
  // A rejected seller updated their profile and went back to pending.
  RESUBMITTED = 'resubmitted',
  // An admin edited status and/or activeStatus directly.
  ADMIN_UPDATED = 'admin_updated',
}
