'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PhoneInput } from '@/components/phone-input';
import { sellerLogin } from '@/lib/api/seller-portal';
import { ApiError } from '@/lib/api/http';
import { setSellerToken } from '@/lib/auth/seller-token';

export default function SellerLoginPage() {
  const router = useRouter();
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
      const response = await sellerLogin(phone, password);
      setSellerToken(response.accessToken);
      router.replace('/seller/profile');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed.');
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
        <h1 className="mb-1 text-lg font-semibold text-foreground">Seller login</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Sign in with your phone number and password.
        </p>

        {error && (
          <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mb-4 text-sm text-foreground">
          <span className="mb-1 block">Phone number</span>
          <PhoneInput onChange={setPhone} required />
        </div>

        <label className="mb-6 block text-sm text-foreground">
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          New seller?{' '}
          <Link href="/seller/register" className="font-medium text-primary hover:opacity-70">
            Register
          </Link>
        </p>
      </form>
    </div>
  );
}
