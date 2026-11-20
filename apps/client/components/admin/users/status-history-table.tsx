'use client';

import Link from 'next/link';
import type { UserStatusHistoryEntry } from '@/types/user';

function Transition({ from, to }: { from: string | null; to: string }) {
  return (
    <p className="text-foreground">
      {from && <span className="capitalize">{from}</span>}
      {from && ' → '}
      <span className="font-medium capitalize">{to}</span>
    </p>
  );
}

export function UserStatusHistoryTable({
  entries,
  showUser,
}: {
  entries: UserStatusHistoryEntry[];
  showUser: boolean;
}) {
  const columns = showUser ? 5 : 4;
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">When</th>
            {showUser && (
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
            )}
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Change</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reason</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">By</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.length === 0 && (
            <tr>
              <td colSpan={columns} className="px-4 py-6 text-center text-muted-foreground">
                No history found.
              </td>
            </tr>
          )}
          {entries.map((entry) => (
            <tr key={entry.id} className="align-top">
              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                {new Date(entry.createdAt).toLocaleString()}
              </td>
              {showUser && (
                <td className="px-4 py-3">
                  {entry.user ? (
                    <Link
                      href={`/admin/users/${entry.user.id}`}
                      className="font-medium text-primary hover:opacity-70"
                    >
                      {entry.user.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">User #{entry.userId}</span>
                  )}
                  <p className="text-xs text-muted-foreground">{entry.user?.phone ?? ''}</p>
                </td>
              )}
              <td className="px-4 py-3">
                <Transition from={entry.fromStatus} to={entry.toStatus} />
              </td>
              <td className="max-w-xs px-4 py-3 text-foreground">
                {entry.reason ?? <span className="text-muted-foreground">—</span>}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                <span className="text-foreground">{entry.creatorName ?? '—'}</span>
                {entry.creatorType && (
                  <span className="block text-xs capitalize">{entry.creatorType}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
