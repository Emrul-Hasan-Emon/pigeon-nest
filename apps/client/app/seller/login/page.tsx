'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bird, Coins, Feather, Package, ReceiptText } from 'lucide-react';
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
      router.replace('/seller/dashboard');
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
          <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-sheen-a to-sheen-b text-white shadow-[0_6px_20px_-6px_rgb(122_91_208/0.8)]">
            <Bird className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="font-[family-name:var(--font-serif)] text-xl font-semibold tracking-tight">Pigeon Nest</span>
        </span>
        <div className="relative">
          <h2 className="font-[family-name:var(--font-serif)] text-5xl font-medium leading-[1.08] tracking-tight">
            Sell your birds<br />with confidence.
          </h2>
          <ul className="mt-6 space-y-3 text-lg text-topbar-foreground/80">
            <li className="flex items-center gap-3"><Package aria-hidden="true" className="h-5 w-5 text-signal" /> Add your birds and supplies</li>
            <li className="flex items-center gap-3"><ReceiptText aria-hidden="true" className="h-5 w-5 text-signal" /> See and confirm every order</li>
            <li className="flex items-center gap-3"><Coins aria-hidden="true" className="h-5 w-5 text-signal" /> Know exactly what you earn</li>
          </ul>
        </div>
        <span className="relative text-sm text-topbar-foreground/45">&copy; {new Date().getFullYear()} Pigeon Nest</span>
      </div>

      <div className="flex w-full items-center justify-center p-8 md:w-1/2">
        <form onSubmit={handleSubmit} className="w-full max-w-md">
          <span aria-hidden="true" className="mb-6 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-sheen-a to-sheen-b text-white md:hidden">
            <Bird className="h-5 w-5" strokeWidth={2} />
          </span>
          <h1 className="font-[family-name:var(--font-serif)] text-4xl font-medium tracking-tight text-foreground">Welcome back</h1>
          <p className="mb-8 mt-2 text-base text-muted-foreground">Sign in with your phone number and password.</p>

          {error && (
            <p role="alert" className="mb-5 rounded-xl bg-destructive/10 px-4 py-3 text-base font-medium text-destructive">
              {error}
            </p>
          )}

          <div className="mb-5 text-base font-medium text-foreground">
            <span className="mb-1.5 block">Phone number</span>
            <PhoneInput onChange={setPhone} required />
          </div>

          <label className="mb-7 block text-base font-medium text-foreground">
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 min-h-12 w-full rounded-xl border border-input bg-white px-4 py-2.5 text-base font-normal focus:border-ring focus:ring-4 focus:ring-ring/20 focus:outline-none"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-base font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[hsl(177_62%_22%)] disabled:opacity-50"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="mt-6 text-center text-base text-muted-foreground">
            New seller?{' '}
            <Link href="/seller/register" className="font-semibold text-primary underline-offset-4 hover:underline">
              Create an account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
