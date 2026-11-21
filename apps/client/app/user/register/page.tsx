'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PhoneInput } from '@/components/phone-input';
import { userRegister } from '@/lib/api/user-portal';
import { ApiError } from '@/lib/api/http';
import { setUserToken } from '@/lib/auth/user-token';
import { safeNextPath, useNextQuery } from '@/lib/auth/next-path';
import { mergeGuestCarts } from '@/lib/api/cart';

const INPUT =
  'mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none';

export default function UserRegisterPage() {
  const router = useRouter();
  const nextQuery = useNextQuery();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Name is required.');
    if (!phone) return setError('Enter a valid phone number.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');

    setSubmitting(true);
    try {
      const response = await userRegister({
        name,
        phone,
        password,
        email: email.trim() || undefined,
      });
      setUserToken(response.accessToken);
      await mergeGuestCarts();
      router.replace(safeNextPath(new URLSearchParams(window.location.search).get('next'), '/user/profile'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm"
      >
        <h1 className="mb-1 text-lg font-semibold text-foreground">Create an account</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Register with your phone number and a password.
        </p>

        {error && (
          <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="space-y-4">
          <label className="block text-sm text-foreground">
            Name *
            <input required value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
          </label>
          <div className="text-sm text-foreground">
            <span className="mb-1 block">Phone number *</span>
            <PhoneInput onChange={setPhone} required />
          </div>
          <label className="block text-sm text-foreground">
            Email (optional)
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm text-foreground">
              Password *
              <input type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} />
            </label>
            <label className="block text-sm text-foreground">
              Confirm password *
              <input type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={INPUT} />
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Register'}
        </button>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already registered?{' '}
          <Link href={`/user/login${nextQuery}`} className="font-medium text-primary hover:opacity-70">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
