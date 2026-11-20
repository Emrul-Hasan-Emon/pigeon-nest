'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createSeller, updateSeller } from '@/lib/api/sellers';
import { ApiError, NotFoundApiError } from '@/lib/api/http';
import { useToast } from '@/components/ui/toast';
import { PhoneInput } from '@/components/phone-input';
import type { Seller, SellerActiveStatus, SellerStatus } from '@/types/seller';

interface FormState {
  name: string;
  email: string;
  phone: string;
  password: string;
  commissionRate: number;
  status: SellerStatus;
  activeStatus: SellerActiveStatus;
  reason: string;
  avatar: File | null;
  nidFrontImage: File | null;
  nidBackImage: File | null;
}

function toFormState(seller?: Seller): FormState {
  return {
    name: seller?.name ?? '',
    email: seller?.email ?? '',
    phone: seller?.phone ?? '',
    password: '',
    commissionRate: seller?.commissionRate ?? 0,
    status: seller?.status ?? 'approved',
    activeStatus: seller?.activeStatus ?? 'active',
    reason: '',
    avatar: null,
    nidFrontImage: null,
    nidBackImage: null,
  };
}

export function SellerForm({ seller }: { seller?: Seller }) {
  const router = useRouter();
  const { showToast } = useToast();
  const isEdit = seller !== undefined;

  const initial = useMemo(() => toFormState(seller), [seller]);
  const [form, setForm] = useState<FormState>(initial);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    seller?.avatarUrl ?? null,
  );
  const [frontPreview, setFrontPreview] = useState<string | null>(
    seller?.nidFrontImageUrl ?? null,
  );
  const [backPreview, setBackPreview] = useState<string | null>(
    seller?.nidBackImageUrl ?? null,
  );
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function onAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setForm((f) => ({ ...f, avatar: file }));
    setAvatarPreview(file ? URL.createObjectURL(file) : (seller?.avatarUrl ?? null));
  }

  function onFrontChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setForm((f) => ({ ...f, nidFrontImage: file }));
    setFrontPreview(file ? URL.createObjectURL(file) : (seller?.nidFrontImageUrl ?? null));
  }

  function onBackChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setForm((f) => ({ ...f, nidBackImage: file }));
    setBackPreview(file ? URL.createObjectURL(file) : (seller?.nidBackImageUrl ?? null));
  }

  // Status/activity edits are logged; rejecting or suspending needs a note.
  const statusChanged =
    isEdit && (form.status !== initial.status || form.activeStatus !== initial.activeStatus);
  const reasonRequired =
    isEdit &&
    ((form.status === 'rejected' && initial.status !== 'rejected') ||
      (form.activeStatus === 'suspended' && initial.activeStatus !== 'suspended'));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNameError(null);
    setEmailError(null);
    setGeneralError(null);

    if (!form.name.trim()) {
      setNameError('Name is required.');
      return;
    }
    if (!form.phone && (!isEdit || initial.phone)) {
      setEmailError('Enter a valid phone number (with country).');
      return;
    }
    if (isEdit && reasonRequired && !form.reason.trim()) {
      setGeneralError('A reason is required when rejecting or suspending a seller.');
      return;
    }
    if (!isEdit && form.password.trim().length < 6) {
      setGeneralError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        const payload: Record<string, unknown> = {};
        if (form.name !== initial.name) payload.name = form.name;
        if (form.email !== initial.email) payload.email = form.email || undefined;
        if (form.phone !== initial.phone) payload.phone = form.phone || undefined;
        if (form.password) payload.password = form.password;
        if (form.commissionRate !== initial.commissionRate) {
          payload.commissionRate = form.commissionRate;
        }
        if (form.status !== initial.status) payload.status = form.status;
        if (form.activeStatus !== initial.activeStatus) payload.activeStatus = form.activeStatus;
        if (statusChanged && form.reason.trim()) payload.reason = form.reason.trim();
        if (form.avatar) payload.avatar = form.avatar;
        if (form.nidFrontImage) payload.nidFrontImage = form.nidFrontImage;
        if (form.nidBackImage) payload.nidBackImage = form.nidBackImage;

        if (Object.keys(payload).length > 0) {
          await updateSeller(seller!.id, payload);
        }
      } else {
        await createSeller({
          name: form.name,
          email: form.email || undefined,
          phone: form.phone || undefined,
          password: form.password,
          commissionRate: form.commissionRate,
          avatar: form.avatar,
          nidFrontImage: form.nidFrontImage,
          nidBackImage: form.nidBackImage,
        });
      }
      showToast(isEdit ? 'Seller updated.' : 'Seller created.', 'success');
      router.push('/admin/sellers');
    } catch (error) {
      if (error instanceof NotFoundApiError) {
        showToast('That seller no longer exists.', 'error');
        router.push('/admin/sellers');
        return;
      }
      if (error instanceof ApiError) {
        const message = error.message.toLowerCase();
        if (message.includes('name')) {
          setNameError(error.message);
        } else if (message.includes('email') || message.includes('phone')) {
          setEmailError(error.message);
        } else {
          setGeneralError(error.message);
        }
      } else {
        setGeneralError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          {isEdit ? 'Edit seller' : 'Add seller'}
        </h1>
        <Link href="/admin/sellers" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
      </div>

      {generalError && (
        <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {generalError}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-border bg-card p-5 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm text-foreground">
            Name *
            <input
              className={`mt-1 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none ${
                nameError ? 'border-destructive' : 'border-input'
              }`}
              required
              value={form.name}
              onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
            />
            {nameError && <p className="mt-1 text-xs text-destructive">{nameError}</p>}
          </label>

          <label className="text-sm text-foreground">
            Commission rate (%)
            <input
              type="number"
              step="0.01"
              min={0}
              max={100}
              className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
              value={form.commissionRate}
              onChange={(event) =>
                setForm((f) => ({ ...f, commissionRate: Number(event.target.value) }))
              }
            />
          </label>

          <label className="text-sm text-foreground">
            Email
            <input
              type="email"
              className={`mt-1 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none ${
                emailError ? 'border-destructive' : 'border-input'
              }`}
              value={form.email}
              onChange={(event) => setForm((f) => ({ ...f, email: event.target.value }))}
            />
            {emailError && <p className="mt-1 text-xs text-destructive">{emailError}</p>}
          </label>

          <div className="text-sm text-foreground">
            <span className="mb-1 block">Phone *</span>
            <PhoneInput
              defaultValue={initial.phone}
              onChange={(phone) => setForm((f) => ({ ...f, phone }))}
            />
          </div>

          <label className="text-sm text-foreground">
            {isEdit ? 'New password (leave blank to keep)' : 'Password *'}
            <input
              type="password"
              required={!isEdit}
              className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
              value={form.password}
              onChange={(event) => setForm((f) => ({ ...f, password: event.target.value }))}
            />
          </label>

          {isEdit && (
            <label className="text-sm text-foreground">
              Status
              <select
                className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
                value={form.status}
                onChange={(event) =>
                  setForm((f) => ({ ...f, status: event.target.value as SellerStatus }))
                }
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
          )}

          {isEdit && (
            <label className="text-sm text-foreground">
              Activity
              <select
                className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
                value={form.activeStatus}
                onChange={(event) =>
                  setForm((f) => ({
                    ...f,
                    activeStatus: event.target.value as SellerActiveStatus,
                  }))
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended (blocks everything, even profile edits)</option>
              </select>
            </label>
          )}

          {statusChanged && (
            <label className="text-sm text-foreground md:col-span-2">
              {reasonRequired
                ? 'Reason * (required to reject or suspend; saved in the status history)'
                : 'Note (optional, saved in the status history)'}
              <textarea
                rows={2}
                maxLength={1000}
                required={reasonRequired}
                className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
                value={form.reason}
                onChange={(event) => setForm((f) => ({ ...f, reason: event.target.value }))}
              />
              {form.status === 'rejected' && initial.status !== 'rejected' && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  The seller will see this reason.
                </span>
              )}
            </label>
          )}
        </div>

        <div className="mt-5">
          <span className="text-sm font-medium text-foreground">Profile picture</span>
          <div className="mt-2 flex items-center gap-4 rounded-lg border border-dashed border-border p-4">
            {avatarPreview ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarPreview}
                  alt=""
                  className="h-20 w-20 rounded-full border border-border object-cover"
                />
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-center text-xs font-medium text-foreground hover:bg-muted">
                    Change
                    <input type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForm((f) => ({ ...f, avatar: null }));
                      setAvatarPreview(null);
                    }}
                    className="text-left text-xs text-destructive"
                  >
                    Remove
                  </button>
                </div>
              </>
            ) : (
              <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-1 py-6 text-center text-sm text-muted-foreground">
                <input type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
                Upload a profile picture (JPG / PNG / WEBP)
              </label>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <span className="text-sm font-medium text-foreground">NID front</span>
            <div className="mt-2 flex items-start gap-4 rounded-lg border border-dashed border-border p-4">
              {frontPreview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={frontPreview}
                    alt=""
                    className="h-20 w-28 rounded-md border border-border object-cover"
                  />
                  <label className="cursor-pointer self-start rounded-md border border-border px-3 py-1.5 text-center text-xs font-medium text-foreground hover:bg-muted">
                    Change
                    <input type="file" accept="image/*" className="hidden" onChange={onFrontChange} />
                  </label>
                </>
              ) : (
                <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-1 py-6 text-center text-sm text-muted-foreground">
                  <input type="file" accept="image/*" className="hidden" onChange={onFrontChange} />
                  Upload NID front
                </label>
              )}
            </div>
          </div>

          <div>
            <span className="text-sm font-medium text-foreground">NID back</span>
            <div className="mt-2 flex items-start gap-4 rounded-lg border border-dashed border-border p-4">
              {backPreview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={backPreview}
                    alt=""
                    className="h-20 w-28 rounded-md border border-border object-cover"
                  />
                  <label className="cursor-pointer self-start rounded-md border border-border px-3 py-1.5 text-center text-xs font-medium text-foreground hover:bg-muted">
                    Change
                    <input type="file" accept="image/*" className="hidden" onChange={onBackChange} />
                  </label>
                </>
              ) : (
                <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-1 py-6 text-center text-sm text-muted-foreground">
                  <input type="file" accept="image/*" className="hidden" onChange={onBackChange} />
                  Upload NID back
                </label>
              )}
            </div>
          </div>
        </div>

        {!isEdit && (
          <p className="mt-3 text-xs text-muted-foreground">
            Sellers created here are approved and active immediately.
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Saving…' : isEdit ? 'Update seller' : 'Create seller'}
        </button>
      </form>
    </div>
  );
}
