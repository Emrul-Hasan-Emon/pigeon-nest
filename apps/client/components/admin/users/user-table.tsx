'use client';

import Link from 'next/link';
import type { User, UserStatus } from '@/types/user';
import { Avatar } from '../initials-avatar';

export const USER_STATUS_STYLES: Record<UserStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  suspended: 'bg-red-100 text-red-700',
};

export function UserTable({ users }: { users: User[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted">
          <tr>
            {['Avatar', 'Name', 'Email', 'Phone', 'Status', 'Joined'].map((h) => (
              <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">
                {h}
              </th>
            ))}
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                No users found.
              </td>
            </tr>
          )}
          {users.map((user) => (
            <tr key={user.id} className="border-t border-border">
              <td className="px-4 py-3">
                <Avatar name={user.name} url={user.avatarUrl} />
              </td>
              <td className="px-4 py-3 font-medium text-foreground">{user.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{user.email ?? '—'}</td>
              <td className="px-4 py-3 text-muted-foreground">{user.phone ?? '—'}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${USER_STATUS_STYLES[user.status]}`}>
                  {user.status}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(user.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-right">
                <Link href={`/admin/users/${user.id}`} className="font-medium text-primary hover:opacity-70">
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
