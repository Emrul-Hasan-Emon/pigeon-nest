'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { listSellers } from '@/lib/api/sellers';
import { adminProductPortal, type ProductPortal } from '@/lib/products/portal';
import { flattenCategoryTree } from '@/lib/category-tree';
import { ApiError } from '@/lib/api/http';
import { Opt, Req, RequiredLegend } from '@/components/products/field-tag';
import { useToast } from '@/components/ui/toast';
import { BirdProductFields, birdCreateFields, emptyBirdForm, saveNewParents, type BirdForm } from '@/components/products/bird-fields';
import {
  buildCreateSkus,
  emptySkuDraft,
  ProductSkuEditor,
  validateSkuDrafts,
  type SkuDraft,
} from './product-sku-editor';
import type { ProductActiveStatus, ProductStatus } from '@/types/product';
import type { Seller } from '@/types/seller';
import type { CategoryTreeNode } from '@/types/category';
import type { Collection } from '@/types/collection';
import type { Attribute } from '@/types/attribute';

interface FormState {
  sellerId: string;
  categoryId: string;
  collectionId: string;
  name: string;
  description: string;
  isFeatured: boolean;
  status: ProductStatus;
  activeStatus: ProductActiveStatus;
  reason: string;
  seoTitle: string;
  seoDescription: string;
}

const EMPTY: FormState = {
  sellerId: '',
  categoryId: '',
  collectionId: '',
  name: '',
  description: '',
  isFeatured: false,
  status: 'approved',
  activeStatus: 'active',
  reason: '',
  seoTitle: '',
  seoDescription: '',
};

const fieldClass =
  'mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none';

export function ProductCreateForm({ portal = adminProductPortal }: { portal?: ProductPortal }) {
  const isAdmin = portal.kind === 'admin';
  const router = useRouter();
  const { showToast } = useToast();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [skus, setSkus] = useState<SkuDraft[]>(() => [emptySkuDraft(true)]);
  const [bird, setBird] = useState<BirdForm>(emptyBirdForm);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [gallery, setGallery] = useState<File[]>([]);

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [tree, setTree] = useState<CategoryTreeNode[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);

  const [nameError, setNameError] = useState<string | null>(null);
  const [sellerError, setSellerError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const categoryOptions = useMemo(() => flattenCategoryTree(tree), [tree]);
  const needsReason = form.status === 'rejected' || form.activeStatus === 'suspended';
  const thumbnailPreview = useMemo(
    () => (thumbnail ? URL.createObjectURL(thumbnail) : null),
    [thumbnail],
  );

  useEffect(() => {
    if (isAdmin) {
      listSellers({ status: 'approved', activeStatus: 'active', limit: 100 })
        .then((response) => setSellers(response.results))
        .catch(() => showToast('Failed to load sellers.', 'error'));
    }
    portal
      .categoryTree()
      .then(setTree)
      .catch(() => showToast('Failed to load categories.', 'error'));
    portal
      .collections()
      .then(setCollections)
      .catch(() => showToast('Failed to load collections.', 'error'));
    portal
      .attributes()
      .then(setAttributes)
      .catch(() => showToast('Failed to load attributes.', 'error'));
  }, [isAdmin, portal, showToast]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNameError(null);
    setSellerError(null);
    setGeneralError(null);

    if (!form.name.trim()) return setNameError('Name is required.');
    if (isAdmin && !form.sellerId) return setSellerError('Seller is required.');
    if (!form.categoryId) return setGeneralError('Category is required.');
    if (isAdmin && needsReason && !form.reason.trim()) {
      return setGeneralError('A reason is required when rejecting or suspending a product.');
    }
    const skuError = validateSkuDrafts(skus);
    if (skuError) return setGeneralError(skuError);

    setSubmitting(true);
    let createdId: number | null = null;
    try {
      const product = await portal.create({
        ...(isAdmin ? { sellerId: Number(form.sellerId) } : {}),
        categoryId: Number(form.categoryId),
        collectionId: form.collectionId ? Number(form.collectionId) : undefined,
        name: form.name,
        description: form.description || undefined,
        ...(isAdmin
          ? {
              isFeatured: form.isFeatured,
              status: form.status,
              ...(form.reason.trim() ? { reason: form.reason.trim() } : {}),
            }
          : {}),
        activeStatus: form.activeStatus,
        seoTitle: form.seoTitle || undefined,
        seoDescription: form.seoDescription || undefined,
        ...birdCreateFields(bird),
        skus: buildCreateSkus(skus),
      });
      createdId = product.id;

      // Father and mother need the saved option, so they go up now. Options are saved in the order they were typed.
      const typed = skus.filter((d) => !d.removed).map((d) => d.newParents);
      const ids = [...(product.skus ?? [])].sort((a, b) => a.id - b.id).map((k) => k.id);
      const failedParents = await saveNewParents(portal, product.id, ids, typed);
      if (failedParents > 0) {
        showToast('Product created, but a father or mother could not be saved. Add them from the edit page.', 'error');
        router.push(portal.editPath(product.id));
        return;
      }

      if (thumbnail || gallery.length > 0) {
        await portal.updateMedia(product.id, {
          thumbnailImage: thumbnail,
          mediaFiles: gallery,
        });
      }
      showToast('Product created.', 'success');
      router.push(portal.afterCreatePath(product.id));
    } catch (error) {
      if (createdId !== null) {
        showToast('Product created, but uploading media failed. Add it from the edit page.', 'error');
        router.push(portal.editPath(createdId));
        return;
      }
      if (error instanceof ApiError) {
        const message = error.message.toLowerCase();
        if (message.includes('name')) setNameError(error.message);
        else if (message.includes('seller')) setSellerError(error.message);
        else setGeneralError(error.message);
      } else {
        setGeneralError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Add product</h1>
        <Link href={portal.basePath} className="text-sm text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
      </div>

      {generalError && (
        <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{generalError}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <RequiredLegend />
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {isAdmin && (
            <label className="text-sm text-foreground">
              Seller <Req />
              <select
                className={`${fieldClass} ${sellerError ? 'border-destructive' : ''}`}
                value={form.sellerId}
                onChange={(event) => setForm((f) => ({ ...f, sellerId: event.target.value }))}
              >
                <option value="">— Select seller —</option>
                {sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.name}
                  </option>
                ))}
              </select>
              {sellerError && <p className="mt-1 text-xs text-destructive">{sellerError}</p>}
            </label>
            )}

            <label className="text-sm text-foreground">
              Category <Req />
              <select
                className={fieldClass}
                value={form.categoryId}
                onChange={(event) => setForm((f) => ({ ...f, categoryId: event.target.value }))}
              >
                <option value="">— Select category —</option>
                {categoryOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {'—'.repeat(option.depth)} {option.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-foreground">
              Name <Req />
              <input
                className={`${fieldClass} ${nameError ? 'border-destructive' : ''}`}
                value={form.name}
                onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
              />
              {nameError && <p className="mt-1 text-xs text-destructive">{nameError}</p>}
            </label>

            <label className="text-sm text-foreground">
              Collection <Opt />
              <select
                className={fieldClass}
                value={form.collectionId}
                onChange={(event) => setForm((f) => ({ ...f, collectionId: event.target.value }))}
              >
                <option value="">— None —</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-foreground md:col-span-2">
              Description <Opt />
              <textarea
                className={fieldClass}
                rows={3}
                value={form.description}
                onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))}
              />
            </label>

            {isAdmin && (
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.isFeatured}
                  onChange={(event) => setForm((f) => ({ ...f, isFeatured: event.target.checked }))}
                />
                Featured <Opt />
              </label>
            )}
            {isAdmin && (
              <label className="text-sm text-foreground">
                Review status <Opt />
                <select
                  className={fieldClass}
                  value={form.status}
                  onChange={(event) =>
                    setForm((f) => ({ ...f, status: event.target.value as ProductStatus }))
                  }
                >
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
            )}
            <label className="text-sm text-foreground">
              Activity <Opt />
              <select
                className={fieldClass}
                value={form.activeStatus}
                onChange={(event) =>
                  setForm((f) => ({ ...f, activeStatus: event.target.value as ProductActiveStatus }))
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                {isAdmin && <option value="suspended">Suspended</option>}
              </select>
            </label>
            {isAdmin && needsReason && (
              <label className="text-sm text-foreground md:col-span-2">
                Reason <Req /> <span className="text-xs text-muted-foreground">(needed to reject or suspend)</span>
                <textarea
                  className={fieldClass}
                  rows={2}
                  maxLength={1000}
                  value={form.reason}
                  onChange={(event) => setForm((f) => ({ ...f, reason: event.target.value }))}
                />
              </label>
            )}

            <label className="text-sm text-foreground">
              SEO title <Opt />
              <input
                className={fieldClass}
                value={form.seoTitle}
                onChange={(event) => setForm((f) => ({ ...f, seoTitle: event.target.value }))}
              />
            </label>
            <label className="text-sm text-foreground">
              SEO description <Opt />
              <input
                className={fieldClass}
                value={form.seoDescription}
                onChange={(event) => setForm((f) => ({ ...f, seoDescription: event.target.value }))}
              />
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-1 font-semibold text-foreground">About the birds <Opt /></h2>
          <p className="mb-3 text-xs text-muted-foreground">True for every option of this product. Buyers see it on the product page.</p>
          <BirdProductFields value={bird} onChange={setBird} />
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-foreground">{isAdmin ? 'SKUs' : 'Options you sell (each bird, colour or size)'} <Req /></h2>
          <ProductSkuEditor drafts={skus} onChange={setSkus} attributes={attributes} />
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-foreground">Media <Opt /></h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <span className="text-sm font-medium text-foreground">Thumbnail</span>
              <div className="mt-2 flex items-center gap-3">
                {thumbnailPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbnailPreview} alt="" className="h-16 w-16 rounded-md border border-border object-cover" />
                )}
                <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                  {thumbnail ? 'Change' : 'Choose image'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => setThumbnail(event.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>
            <div>
              <span className="text-sm font-medium text-foreground">Gallery images / videos</span>
              <div className="mt-2">
                <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                  Add files
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      const picked = Array.from(event.target.files ?? []);
                      setGallery((current) => [...current, ...picked]);
                      event.target.value = '';
                    }}
                  />
                </label>
                {gallery.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {gallery.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="flex items-center justify-between">
                        <span className="truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => setGallery((current) => current.filter((_, i) => i !== index))}
                          className="ml-2 text-destructive"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Create product'}
        </button>
      </form>
    </div>
  );
}
