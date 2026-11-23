'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bird, Feather } from 'lucide-react';
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
      router.replace('/admin/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hero-kpi relative hidden w-1/2 flex-col justify-between overflow-hidden bg-topbar p-12 text-topbar-foreground md:flex">
        <Feather aria-hidden="true" strokeWidth={0.5} className="pointer-events-none absolute -bottom-24 -right-16 h-[34rem] w-[34rem] -rotate-12 text-white/[0.06]" />
        <span className="relative flex items-center gap-3">
          <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sheen-a to-sheen-b text-white shadow-[0_6px_20px_-6px_rgb(122_91_208/0.8)]">
            <Bird className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="font-[family-name:var(--font-serif)] text-lg font-semibold tracking-tight">Pigeon Nest</span>
        </span>
        <div className="relative">
          <h2 className="font-[family-name:var(--font-serif)] text-5xl font-medium leading-[1.05] tracking-tight">
            Run the loft,<br />from one desk.
          </h2>
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-topbar-foreground/65">
            Manage sellers, listings, orders and commission across the marketplace.
          </p>
        </div>
        <span className="relative text-xs text-topbar-foreground/45">&copy; {new Date().getFullYear()} Pigeon Nest</span>
      </div>

      <div className="flex w-full items-center justify-center p-8 md:w-1/2">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <span aria-hidden="true" className="mb-6 grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sheen-a to-sheen-b text-white md:hidden">
            <Bird className="h-5 w-5" strokeWidth={2} />
          </span>
          <h1 className="font-[family-name:var(--font-serif)] text-3xl font-medium tracking-tight text-foreground">Admin login</h1>
          <p className="mb-8 mt-1.5 text-sm text-muted-foreground">Sign in to continue to the dashboard.</p>

          {error && (
            <p role="alert" className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <label className="mb-4 block text-sm font-medium text-foreground">
            Email
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-input bg-white px-3.5 py-2.5 text-sm font-normal focus:border-ring focus:ring-[3px] focus:ring-ring/20 focus:outline-none"
            />
          </label>

          <label className="mb-6 block text-sm font-medium text-foreground">
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-input bg-white px-3.5 py-2.5 text-sm font-normal focus:border-ring focus:ring-[3px] focus:ring-ring/20 focus:outline-none"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[hsl(177_62%_22%)] disabled:opacity-50"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
