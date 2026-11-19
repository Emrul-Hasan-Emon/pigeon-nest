import type { SellerView } from '@/types/seller';

const STYLES = {
  full: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  profile: 'border-amber-200 bg-amber-50 text-amber-800',
  none: 'border-red-200 bg-red-50 text-red-800',
} as const;

/** Explains the seller's current approval/active state and what they can do. */
export function StatusBanner({ seller }: { seller: SellerView }) {
  const { access } = seller;
  const level = access.canManage ? 'full' : access.canEditProfile ? 'profile' : 'none';

  const title = access.canManage
    ? 'Account active'
    : {
        SELLER_PENDING: 'Awaiting approval',
        SELLER_REJECTED: 'Registration rejected',
        SELLER_INACTIVE: 'Account inactive',
        SELLER_SUSPENDED: 'Account suspended',
      }[access.code ?? 'SELLER_PENDING'];

  return (
    <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${STYLES[level]}`} role="status">
      <p className="font-semibold">{title}</p>
      <p className="mt-0.5">
        {access.canManage
          ? 'Your account is approved and active. You have full access.'
          : access.reason}
      </p>
      {seller.status === 'rejected' && seller.rejectionReason && (
        <p className="mt-2">
          <span className="font-medium">Reason:</span> {seller.rejectionReason}
        </p>
      )}
      {seller.status === 'rejected' && access.canEditProfile && (
        <p className="mt-1">Update your profile below to submit it for review again.</p>
      )}
    </div>
  );
}
