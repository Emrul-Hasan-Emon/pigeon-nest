'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminLogin } from '@/lib/api/auth';
import { setAdminToken } from '@/lib/auth/admin-token';
import { ApiError } from '@/lib/api/http';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await adminLogin(email, password);
      setAdminToken(response.accessToken);
      router.replace('/admin/catalog/categories');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden w-1/2 flex-col justify-between bg-topbar p-10 text-topbar-foreground md:flex">
        <span className="text-sm font-semibold tracking-wide uppercase opacity-80">
          Pigeon Nest
        </span>
        <div>
          <h2 className="text-3xl font-semibold">Admin Console</h2>
          <p className="mt-2 max-w-sm text-sm opacity-70">
            Manage categories, sellers and orders across the marketplace.
          </p>
        </div>
        <span className="text-xs opacity-50">&copy; {new Date().getFullYear()} Pigeon Nest</span>
      </div>

      <div className="flex w-full items-center justify-center p-8 md:w-1/2">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm"
        >
          <h1 className="mb-1 text-lg font-semibold text-foreground">Admin login</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Sign in to continue to the dashboard.
          </p>

          {error && (
            <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-foreground">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
            />
          </label>

          <label className="mb-5 block text-sm">
            <span className="mb-1 block text-foreground">Password</span>
            <input
              type="password"
              required
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
        </form>
      </div>
    </div>
  );
}
