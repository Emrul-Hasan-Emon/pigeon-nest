'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PhoneInput } from '@/components/phone-input';
import { sellerRegister } from '@/lib/api/seller-portal';
import { ApiError } from '@/lib/api/http';
import { setSellerToken } from '@/lib/auth/seller-token';

function FilePicker({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="block text-sm text-foreground">
      {label}
      <input
        type="file"
        accept="image/*"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        className="mt-1 block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground"
      />
      {file && <span className="mt-1 block truncate text-xs text-muted-foreground">{file.name}</span>}
    </label>
  );
}

export default function SellerRegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [nidFront, setNidFront] = useState<File | null>(null);
  const [nidBack, setNidBack] = useState<File | null>(null);
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
      const response = await sellerRegister({
        name,
        phone,
        password,
        email: email.trim() || undefined,
        avatar,
        nidFrontImage: nidFront,
        nidBackImage: nidBack,
      });
      setSellerToken(response.accessToken);
      router.replace('/seller/profile');
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
        className="w-full max-w-lg rounded-xl border border-border bg-card p-8 shadow-sm"
      >
        <h1 className="mb-1 text-lg font-semibold text-foreground">Register as a seller</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Your registration is reviewed by our team. You can sign in right away to track its status.
        </p>

        {error && (
          <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="space-y-4">
          <label className="block text-sm text-foreground">
            Name *
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
            />
          </label>

          <div className="text-sm text-foreground">
            <span className="mb-1 block">Phone number *</span>
            <PhoneInput onChange={setPhone} required />
          </div>

          <label className="block text-sm text-foreground">
            Email (optional)
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm text-foreground">
              Password *
              <input
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
              />
            </label>
            <label className="block text-sm text-foreground">
              Confirm password *
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
              />
            </label>
          </div>

          <FilePicker label="Profile picture" file={avatar} onChange={setAvatar} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FilePicker label="NID front" file={nidFront} onChange={setNidFront} />
            <FilePicker label="NID back" file={nidBack} onChange={setNidBack} />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Register'}
        </button>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already registered?{' '}
          <Link href="/seller/login" className="font-medium text-primary hover:opacity-70">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
