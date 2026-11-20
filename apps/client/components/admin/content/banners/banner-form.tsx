'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBanner, updateBanner } from '@/lib/api/banners';
import { ApiError } from '@/lib/api/http';
import { fromLocalInput, toLocalInput } from '@/lib/datetime';
import { useToast } from '@/components/ui/toast';
import { BANNER_POSITIONS, type Banner, type BannerPosition } from '@/types/banner';

const fieldClass =
  'mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none';
const MAX_BYTES = 10 * 1024 * 1024;

export function BannerForm({ banner }: { banner?: Banner }) {
  const router = useRouter();
  const { showToast } = useToast();
  const isEdit = banner !== undefined;

  const [title, setTitle] = useState(banner?.title ?? '');
  const [position, setPosition] = useState<BannerPosition>(banner?.position ?? 'home_top');
  const [linkUrl, setLinkUrl] = useState(banner?.linkUrl ?? '');
  const [startsAt, setStartsAt] = useState(toLocalInput(banner?.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(banner?.endsAt));
  const [sortOrder, setSortOrder] = useState(String(banner?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(banner?.isActive ?? true);
  const [image, setImage] = useState<File | null>(null);
  const [mobileImage, setMobileImage] = useState<File | null>(null);
  const [removeMobile, setRemoveMobile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const imagePreview = image ? URL.createObjectURL(image) : (banner?.imageUrl ?? null);
  const mobilePreview = mobileImage
    ? URL.createObjectURL(mobileImage)
    : removeMobile
      ? null
      : (banner?.mobileImageUrl ?? null);

  function pick(setter: (f: File | null) => void) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      if (file && file.size > MAX_BYTES) {
        setError('Images must be 10MB or smaller.');
        return;
      }
      setError(null);
      setter(file);
    };
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!title.trim()) return setError('Title is required.');
    if (!isEdit && !image) return setError('A banner image is required.');
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      return setError('End must be after start.');
    }
    const order = Number(sortOrder);
    if (!Number.isInteger(order) || order < 0 || order > 100000) {
      return setError('Sort order must be a whole number from 0 to 100000.');
    }

    setSubmitting(true);
    try {
      const common = {
        title: title.trim(),
        position,
        linkUrl: linkUrl.trim(),
        sortOrder: order,
        isActive,
        image,
        mobileImage,
      };
      if (isEdit) {
        await updateBanner(banner.id, {
          ...common,
          // blank string clears the date on the server
          startsAt: startsAt ? fromLocalInput(startsAt) : '',
          endsAt: endsAt ? fromLocalInput(endsAt) : '',
          removeMobileImage: removeMobile && !mobileImage ? true : undefined,
        });
        showToast('Banner updated.', 'success');
      } else {
        await createBanner({
          ...common,
          startsAt: fromLocalInput(startsAt),
          endsAt: fromLocalInput(endsAt),
          linkUrl: linkUrl.trim() || undefined,
        });
        showToast('Banner created.', 'success');
      }
      router.push('/admin/content/banners');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold text-foreground">{isEdit ? 'Edit banner' : 'New banner'}</h1>
      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-card p-5 shadow-sm md:grid-cols-2">
        <label className="text-sm text-foreground md:col-span-2">
          Title *
          <input className={fieldClass} value={title} maxLength={300} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="text-sm text-foreground">
          Position
          <select className={fieldClass} value={position} onChange={(e) => setPosition(e.target.value as BannerPosition)}>
            {BANNER_POSITIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-foreground">
          Sort order
          <input className={fieldClass} inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </label>
        <label className="text-sm text-foreground md:col-span-2">
          Link (http(s) URL or in-app path like /shop)
          <input className={fieldClass} value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
        </label>
        <label className="text-sm text-foreground">
          Starts at
          <input type="datetime-local" className={fieldClass} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </label>
        <label className="text-sm text-foreground">
          Ends at
          <input type="datetime-local" className={fieldClass} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-card p-5 shadow-sm md:grid-cols-2">
        <div className="text-sm text-foreground">
          Banner image {isEdit ? '' : '*'}
          <input type="file" accept="image/*" className="mt-1 block w-full text-sm" onChange={pick(setImage)} />
          {imagePreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagePreview} alt="" className="mt-2 max-h-40 rounded-md border border-border object-contain" />
          )}
        </div>
        <div className="text-sm text-foreground">
          Mobile image (optional)
          <input type="file" accept="image/*" className="mt-1 block w-full text-sm" onChange={pick((f) => { setMobileImage(f); if (f) setRemoveMobile(false); })} />
          {mobilePreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mobilePreview} alt="" className="mt-2 max-h-40 rounded-md border border-border object-contain" />
          )}
          {isEdit && banner.mobileImageUrl && !mobileImage && (
            <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={removeMobile} onChange={(e) => setRemoveMobile(e.target.checked)} />
              Remove mobile image (mobile will use the main image)
            </label>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={submitting} className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {submitting ? 'Saving…' : isEdit ? 'Update banner' : 'Create banner'}
        </button>
        <Link href="/admin/content/banners" className="rounded-md border border-border px-5 py-2 text-sm font-medium text-foreground hover:bg-muted">
          Cancel
        </Link>
      </div>
    </form>
  );
}
