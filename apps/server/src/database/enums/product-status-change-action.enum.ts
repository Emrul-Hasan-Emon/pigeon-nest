// Why a product status / activeStatus row was written to the history log.
export enum ProductStatusChangeAction {
  // Starting point recorded for products that existed before history tracking.
  BASELINE = 'baseline',
  ADMIN_CREATED = 'admin_created',
  SELLER_CREATED = 'seller_created',
  // An admin changed status and/or activeStatus.
  ADMIN_UPDATED = 'admin_updated',
  // A seller switched the product between active and inactive.
  SELLER_UPDATED = 'seller_updated',
}
