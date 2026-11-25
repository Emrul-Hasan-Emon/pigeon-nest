'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PhoneInput } from '@/components/phone-input';
import { userLogin } from '@/lib/api/user-portal';
import { ApiError } from '@/lib/api/http';
import { setUserToken } from '@/lib/auth/user-token';
import { mergeGuestCarts } from '@/lib/api/cart';
import { safeNextPath, useNextQuery } from '@/lib/auth/next-path';
import { Container } from '@/components/store/page-parts';

export default function UserLoginPage() {
  const router = useRouter();
  const nextQuery = useNextQuery();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!phone) {
      setError('Enter a valid phone number.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await userLogin(phone, password);
      setUserToken(response.accessToken);
      await mergeGuestCarts();
      router.replace(safeNextPath(new URLSearchParams(window.location.search).get('next'), '/user/profile'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Container className="flex min-h-[calc(100svh-18rem)] items-center justify-center py-16">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md border border-st-line bg-white p-8"
      >
        <h1 className="font-display mb-1 text-2xl font-semibold text-st-ink">Sign in</h1>
        <p className="mb-6 text-sm text-st-slate">
          Your orders, offers and saved birds are waiting.
        </p>

        {error && (
          <p className="mb-4 rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mb-4 text-sm text-st-ink">
          <span className="mb-1 block font-medium">Phone number</span>
          <PhoneInput onChange={setPhone} required />
        </div>

        <label className="mb-6 block text-sm font-medium text-st-ink">
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-sm border border-st-line px-3 py-2 text-sm font-normal focus:border-st-teal focus:outline-none focus:ring-2 focus:ring-st-teal/25"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-st-ink px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-st-teal disabled:opacity-50"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="mt-4 text-center text-sm text-st-slate">
          New here?{' '}
          <Link href={`/user/register${nextQuery}`} className="font-medium text-st-ink underline-offset-2 hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </Container>
  );
}
