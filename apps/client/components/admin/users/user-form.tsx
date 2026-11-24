'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUser, updateUser } from '@/lib/api/users';
import { ApiError, NotFoundApiError } from '@/lib/api/http';
import { useToast } from '@/components/ui/toast';
import { PhoneInput } from '@/components/phone-input';
import { UserStatusHistoryPanel } from '@/components/admin/users/user-status-history-panel';
import type { User, UserStatus } from '@/types/user';

const INPUT =
  'mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none';

export function UserForm({ user }: { user?: User }) {
  const router = useRouter();
  const { showToast } = useToast();
  const isEdit = user !== undefined;

  const initial = useMemo(
    () => ({
      name: user?.name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      status: (user?.status ?? 'active') as UserStatus,
    }),
    [user],
  );

  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<UserStatus>(initial.status);
  const [statusReason, setStatusReason] = useState('');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);

  const statusChanged = isEdit && status !== initial.status;
  const suspending = statusChanged && status === 'suspended';

  function onAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setAvatar(file);
    setAvatarPreview(file ? URL.createObjectURL(file) : (user?.avatarUrl ?? null));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) return setError('Name is required.');
    if (!phone) return setError('Enter a valid phone number (with country).');
    if (!isEdit && password.length < 6) return setError('Password must be at least 6 characters.');
    if (isEdit && password && password.length < 6) {
      return setError('Password must be at least 6 characters.');
    }
    if (suspending && !statusReason.trim()) {
      return setError('A reason is required to suspend a user.');
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        await updateUser(user.id, {
          name: name !== initial.name ? name : undefined,
          email: email !== initial.email ? email : undefined,
          phone: phone !== initial.phone ? phone : undefined,
          password: password || undefined,
          status: statusChanged ? status : undefined,
          statusReason: statusChanged ? statusReason.trim() || undefined : undefined,
          avatar,
        });
        showToast('User updated.', 'success');
        router.refresh();
        router.push('/admin/users');
      } else {
        await createUser({
          name,
          email: email || undefined,
          phone,
          password,
          avatar,
        });
        showToast('User created.', 'success');
        router.push('/admin/users');
      }
    } catch (err) {
      if (err instanceof NotFoundApiError) {
        showToast('That user no longer exists.', 'error');
        router.push('/admin/users');
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setHistoryKey((k) => k + 1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{isEdit ? 'User details' : 'Add user'}</h1>
        <Link href="/admin/users" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
      </div>

      {isEdit && user.status === 'suspended' && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="status">
          <p className="font-semibold">Suspended</p>
          {user.suspensionReason && <p className="mt-0.5">{user.suspensionReason}</p>}
        </div>
      )}

      {error && (
        <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm text-foreground">
            Name *
            <input className={INPUT} required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="text-sm text-foreground">
            Email
            <input type="email" className={INPUT} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <div className="text-sm text-foreground">
            <span className="mb-1 block font-semibold">Phone * (used to sign in)</span>
            <PhoneInput defaultValue={initial.phone} onChange={setPhone} />
          </div>
          <label className="text-sm text-foreground">
            {isEdit ? 'New password (leave blank to keep)' : 'Password *'}
            <input
              type="password"
              required={!isEdit}
              autoComplete="new-password"
              className={INPUT}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {isEdit && (
            <label className="text-sm text-foreground">
              Status
              <select
                className={INPUT}
                value={status}
                onChange={(e) => setStatus(e.target.value as UserStatus)}
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended (can sign in, cannot do anything)</option>
              </select>
            </label>
          )}

          {statusChanged && (
            <label className="text-sm text-foreground md:col-span-2">
              {suspending ? 'Suspension reason * (shown to the user)' : 'Note (optional, logged)'}
              <textarea
                rows={2}
                maxLength={1000}
                className={INPUT}
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
              />
            </label>
          )}
        </div>

        <div className="mt-5">
          <span className="text-sm font-semibold text-foreground">Profile picture</span>
          <div className="mt-2 flex items-center gap-4 rounded-lg border border-dashed border-border p-4">
            {avatarPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt="" className="h-20 w-20 rounded-full border border-border object-cover" />
            )}
            <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
              {avatarPreview ? 'Change' : 'Upload (JPG / PNG / WEBP)'}
              <input type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
            </label>
          </div>
        </div>

        {isEdit && (
          <p className="mt-3 text-xs text-muted-foreground">
            Created {new Date(user.createdAt).toLocaleString()}
            {user.creatorName ? ` by ${user.creatorName} (${user.creatorType})` : ' by the user (self-registered)'}
            .
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Saving…' : isEdit ? 'Update user' : 'Create user'}
        </button>
      </form>

      {isEdit && <UserStatusHistoryPanel key={historyKey} userId={user.id} />}
    </div>
  );
}
