'use client';

import { useEffect, useMemo, useState } from 'react';
import type { UpdateProductPayload } from '@/lib/api/products';
import { adminProductPortal, type ProductPortal } from '@/lib/products/portal';
import { flattenCategoryTree } from '@/lib/category-tree';
import { ApiError } from '@/lib/api/http';
import { useToast } from '@/components/ui/toast';
import {
  buildSkuChanges,
  ProductSkuEditor,
  skuToDraft,
  validateSkuDrafts,
  type SkuDraft,
} from './product-sku-editor';
import type { Product, ProductActiveStatus, ProductStatus } from '@/types/product';
import type { CategoryTreeNode } from '@/types/category';
import type { Collection } from '@/types/collection';
import type { Attribute } from '@/types/attribute';

interface FormState {
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

function toFormState(product: Product): FormState {
  return {
    categoryId: String(product.categoryId),
    collectionId: product.collectionId ? String(product.collectionId) : '',
    name: product.name,
    description: product.description ?? '',
    isFeatured: product.isFeatured,
    status: product.status,
    activeStatus: product.activeStatus,
    reason: '',
    seoTitle: product.seoTitle ?? '',
    seoDescription: product.seoDescription ?? '',
  };
}

const fieldClass =
  'mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none';

export function ProductEditForm({
  product,
  portal = adminProductPortal,
  onSaved,
}: {
  product: Product;
  portal?: ProductPortal;
  onSaved?: (product: Product) => void;
}) {
  const isAdmin = portal.kind === 'admin';
  const { showToast } = useToast();

  const [current, setCurrent] = useState(product);
  const initial = useMemo(() => toFormState(current), [current]);
  const [form, setForm] = useState<FormState>(initial);
  const [skus, setSkus] = useState<SkuDraft[]>(() => (product.skus ?? []).map(skuToDraft));

  const [tree, setTree] = useState<CategoryTreeNode[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);

  const [nameError, setNameError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const categoryOptions = useMemo(() => flattenCategoryTree(tree), [tree]);
  const statusChanged = form.status !== initial.status || form.activeStatus !== initial.activeStatus;
  const needsReason =
    (form.status === 'rejected' && initial.status !== 'rejected') ||
    (form.activeStatus === 'suspended' && initial.activeStatus !== 'suspended');

  useEffect(() => {
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
  }, [portal, showToast]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNameError(null);
    setGeneralError(null);

    if (!form.name.trim()) return setNameError('Name is required.');
    const skuError = validateSkuDrafts(skus);
    if (skuError) return setGeneralError(skuError);
    if (isAdmin && needsReason && !form.reason.trim()) {
      return setGeneralError('A reason is required when rejecting or suspending a product.');
    }

    const payload: UpdateProductPayload = {};
    if (form.name !== initial.name) payload.name = form.name;
    if (form.description !== initial.description) payload.description = form.description;
    if (form.categoryId !== initial.categoryId) payload.categoryId = Number(form.categoryId);
    if (form.collectionId !== initial.collectionId) {
      payload.collectionId = form.collectionId ? Number(form.collectionId) : null;
    }
    if (isAdmin && form.isFeatured !== initial.isFeatured) payload.isFeatured = form.isFeatured;
    if (isAdmin && form.status !== initial.status) payload.status = form.status;
    if (form.activeStatus !== initial.activeStatus) payload.activeStatus = form.activeStatus;
    if (isAdmin && (payload.status || payload.activeStatus) && form.reason.trim()) {
      payload.reason = form.reason.trim();
    }
    if (form.seoTitle !== initial.seoTitle) payload.seoTitle = form.seoTitle;
    if (form.seoDescription !== initial.seoDescription) payload.seoDescription = form.seoDescription;

    const changes = buildSkuChanges(skus);
    payload.skus = changes.skus;
    if (changes.removeSkuIds.length > 0) payload.removeSkuIds = changes.removeSkuIds;

    setSubmitting(true);
    try {
      const updated = await portal.update(current.id, payload);
      setCurrent(updated);
      onSaved?.(updated);
      setForm(toFormState(updated));
      setSkus((updated.skus ?? []).map(skuToDraft));
      showToast('Product updated.', 'success');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.message.toLowerCase().includes('name')) setNameError(error.message);
        else setGeneralError(error.message);
      } else {
        setGeneralError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {generalError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{generalError}</p>
      )}

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="mb-3 text-xs text-muted-foreground">
          Seller: <span className="font-medium text-foreground">{current.seller?.name ?? '—'}</span> (cannot be
          changed)
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm text-foreground">
            Name *
            <input
              className={`${fieldClass} ${nameError ? 'border-destructive' : ''}`}
              value={form.name}
              onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
            />
            {nameError && <p className="mt-1 text-xs text-destructive">{nameError}</p>}
          </label>

          <label className="text-sm text-foreground">
            Category
            <select
              className={fieldClass}
              value={form.categoryId}
              onChange={(event) => setForm((f) => ({ ...f, categoryId: event.target.value }))}
            >
              {categoryOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {'—'.repeat(option.depth)} {option.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-foreground">
            Collection
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
            Description
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
              Featured
            </label>
          )}
          {isAdmin && (
            <label className="text-sm text-foreground">
              Review status
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
            Activity
            <select
              className={fieldClass}
              value={form.activeStatus}
              onChange={(event) =>
                setForm((f) => ({ ...f, activeStatus: event.target.value as ProductActiveStatus }))
              }
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              {(isAdmin || form.activeStatus === 'suspended') && (
                <option value="suspended" disabled={!isAdmin}>
                  Suspended
                </option>
              )}
            </select>
          </label>
          {isAdmin && statusChanged && (
            <label className="text-sm text-foreground md:col-span-2">
              Reason {needsReason ? '(required for reject / suspend)' : '(optional)'}
              <textarea
                className={fieldClass}
                rows={2}
                maxLength={1000}
                value={form.reason}
                onChange={(event) => setForm((f) => ({ ...f, reason: event.target.value }))}
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                Saved in the status history and shown to the seller.
              </span>
            </label>
          )}

          <label className="text-sm text-foreground">
            SEO title
            <input
              className={fieldClass}
              value={form.seoTitle}
              onChange={(event) => setForm((f) => ({ ...f, seoTitle: event.target.value }))}
            />
          </label>
          <label className="text-sm text-foreground">
            SEO description
            <input
              className={fieldClass}
              value={form.seoDescription}
              onChange={(event) => setForm((f) => ({ ...f, seoDescription: event.target.value }))}
            />
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-1 font-semibold text-foreground">SKUs</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Variants and SKU codes are fixed once created. To change them, remove the SKU and add a new one.
        </p>
        <ProductSkuEditor drafts={skus} onChange={setSkus} attributes={attributes} />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Saving…' : 'Update product'}
      </button>
    </form>
  );
}
