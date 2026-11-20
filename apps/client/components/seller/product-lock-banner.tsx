import type { Product } from '@/types/product';

/** Tells a seller why a product is frozen (rejected / suspended) and why. */
export function ProductLockBanner({ product }: { product: Product }) {
  const rejected = product.status === 'rejected';
  const suspended = product.activeStatus === 'suspended';
  if (!rejected && !suspended) return null;
  return (
    <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="status">
      <p className="font-semibold">
        {rejected && suspended
          ? 'Rejected and suspended by an admin'
          : rejected
            ? 'Rejected by an admin'
            : 'Suspended by an admin'}
      </p>
      <p className="mt-0.5">You can view this product but cannot change it.</p>
      {rejected && product.rejectionReason && (
        <p className="mt-2">
          <span className="font-medium">Rejection reason:</span> {product.rejectionReason}
        </p>
      )}
      {suspended && product.suspensionReason && (
        <p className="mt-1">
          <span className="font-medium">Suspension reason:</span> {product.suspensionReason}
        </p>
      )}
    </div>
  );
}
