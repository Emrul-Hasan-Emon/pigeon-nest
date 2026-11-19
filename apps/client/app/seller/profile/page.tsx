'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PhoneInput } from '@/components/phone-input';
import { StatusBanner } from '@/components/seller/status-banner';
import { useToast } from '@/components/ui/toast';
import { changeMyPassword, getMyProfile, updateMyProfile } from '@/lib/api/seller-portal';
import { ApiError } from '@/lib/api/http';
import { clearSellerToken, getSellerToken } from '@/lib/auth/seller-token';
import type { SellerView } from '@/types/seller';

export default function SellerProfilePage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [seller, setSeller] = useState<SellerView | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [nidFront, setNidFront] = useState<File | null>(null);
  const [nidBack, setNidBack] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const logout = useCallback(() => {
    clearSellerToken();
    router.replace('/seller/login');
  }, [router]);

  const applySeller = useCallback((next: SellerView) => {
    setSeller(next);
    setName(next.name);
    setEmail(next.email ?? '');
    setPhone(next.phone ?? '');
    setAvatar(null);
    setNidFront(null);
    setNidBack(null);
  }, []);

  useEffect(() => {
    if (!getSellerToken()) {
      router.replace('/seller/login');
      return;
    }
    getMyProfile()
      .then(applySeller)
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) {
          logout();
          return;
        }
        showToast('Failed to load your profile.', 'error');
      })
      .finally(() => setLoading(false));
  }, [router, applySeller, logout, showToast]);

  if (loading) return <p className="py-20 text-center text-muted-foreground">Loading…</p>;
  if (!seller) return null;

  const canEdit = seller.access.canEditProfile;

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!seller) return;
    setProfileError(null);
    if (!name.trim()) return setProfileError('Name is required.');
    if (!phone) return setProfileError('Enter a valid phone number.');

    setSaving(true);
    try {
      const wasRejected = seller.status === 'rejected';
      const updated = await updateMyProfile({
        name: name !== seller.name ? name : undefined,
        email: email !== (seller.email ?? '') ? email : undefined,
        phone: phone !== seller.phone ? phone : undefined,
        avatar,
        nidFrontImage: nidFront,
        nidBackImage: nidBack,
      });
      applySeller(updated);
      showToast(
        wasRejected && updated.status === 'pending'
          ? 'Profile updated and resubmitted for review.'
          : 'Profile updated.',
        'success',
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return logout();
      if (error instanceof ApiError && error.status === 403) {
        // Status changed on the server (e.g. suspended); reload to reflect it.
        getMyProfile().then(applySeller).catch(() => undefined);
      }
      setProfileError(error instanceof ApiError ? error.message : 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePassword(event: React.FormEvent) {
    event.preventDefault();
    setPasswordError(null);
    if (newPassword.length < 8) return setPasswordError('New password must be at least 8 characters.');
    setChangingPassword(true);
    try {
      await changeMyPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      showToast('Password changed.', 'success');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401 && error.message.toLowerCase().includes('current')) {
        setPasswordError(error.message);
      } else if (error instanceof ApiError && error.status === 401) {
        logout();
      } else {
        setPasswordError(error instanceof ApiError ? error.message : 'Failed to change password.');
      }
    } finally {
      setChangingPassword(false);
    }
  }

  const inputClass =
    'mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none disabled:opacity-60';

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-14 items-center justify-between bg-topbar px-6 text-topbar-foreground">
        <span className="text-sm font-semibold tracking-wide">Pigeon Nest · Seller</span>
        <button type="button" onClick={logout} className="text-sm opacity-80 hover:opacity-100">
          Log out
        </button>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-6">
        <h1 className="mb-4 text-2xl font-bold text-foreground">My profile</h1>
        <StatusBanner seller={seller} />

        <form
          onSubmit={handleSave}
          className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm"
        >
          <h2 className="mb-4 text-base font-semibold text-foreground">Profile details</h2>
          {profileError && (
            <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {profileError}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm text-foreground">
              Name
              <input className={inputClass} disabled={!canEdit} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="text-sm text-foreground">
              Email
              <input type="email" className={inputClass} disabled={!canEdit} value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <div className="text-sm text-foreground md:col-span-2">
              <span className="mb-1 block">Phone number (used to sign in)</span>
              <PhoneInput defaultValue={seller.phone ?? ''} onChange={setPhone} disabled={!canEdit} />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            {(
              [
                ['Profile picture', seller.avatarUrl, setAvatar, avatar],
                ['NID front', seller.nidFrontImageUrl, setNidFront, nidFront],
                ['NID back', seller.nidBackImageUrl, setNidBack, nidBack],
              ] as const
            ).map(([label, url, setFile, file]) => (
              <div key={label} className="text-sm text-foreground">
                <span className="block">{label}</span>
                {url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt="" className="mt-2 h-24 w-full rounded-md border border-border object-cover" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  disabled={!canEdit}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="mt-2 block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground disabled:opacity-60"
                />
                {file && <span className="mt-1 block truncate text-xs text-muted-foreground">{file.name}</span>}
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={!canEdit || saving}
            className="mt-5 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : seller.status === 'rejected' ? 'Save and resubmit' : 'Save changes'}
          </button>
        </form>

        <form onSubmit={handlePassword} className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-foreground">Change password</h2>
          {passwordError && (
            <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {passwordError}
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm text-foreground">
              Current password
              <input type="password" required autoComplete="current-password" className={inputClass} disabled={!canEdit} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </label>
            <label className="text-sm text-foreground">
              New password
              <input type="password" required autoComplete="new-password" className={inputClass} disabled={!canEdit} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </label>
          </div>
          <button
            type="submit"
            disabled={!canEdit || changingPassword}
            className="mt-5 rounded-md border border-border px-5 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
          >
            {changingPassword ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </main>
    </div>
  );
}
