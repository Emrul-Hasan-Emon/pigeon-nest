// Availability of a seller product. Admin and seller can switch between
// active and inactive; only an admin can suspend.
export enum ProductActiveStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}
