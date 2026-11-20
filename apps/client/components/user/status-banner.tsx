import type { UserView } from '@/types/user';

/** Explains the account state; a suspended user can look but not change anything. */
export function UserStatusBanner({ user }: { user: UserView }) {
  if (user.access.canUse) return null;
  return (
    <div
      className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      role="status"
    >
      <p className="font-semibold">Account suspended</p>
      <p className="mt-0.5">{user.access.reason}</p>
      {user.suspensionReason && (
        <p className="mt-2">
          <span className="font-medium">Reason:</span> {user.suspensionReason}
        </p>
      )}
    </div>
  );
}
