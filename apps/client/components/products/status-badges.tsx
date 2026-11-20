import type { Product, ProductActiveStatus, ProductStatus } from '@/types/product';

export const PRODUCT_STATUS_STYLES: Record<ProductStatus, string> = {
  approved: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
};

export const PRODUCT_ACTIVE_STYLES: Record<ProductActiveStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-muted text-muted-foreground',
  suspended: 'bg-red-100 text-red-700',
};

/** Shown on the storefront only when approved AND active. */
export function isProductVisible(product: Pick<Product, 'status' | 'activeStatus'>) {
  return product.status === 'approved' && product.activeStatus === 'active';
}

const badge = 'rounded-full px-2.5 py-0.5 text-xs font-medium capitalize';

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return <span className={`${badge} ${PRODUCT_STATUS_STYLES[status]}`}>{status}</span>;
}

export function ProductActiveBadge({ status }: { status: ProductActiveStatus }) {
  return <span className={`${badge} ${PRODUCT_ACTIVE_STYLES[status]}`}>{status}</span>;
}
