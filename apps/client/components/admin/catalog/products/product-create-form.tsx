'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createProduct, updateProductMediaFiles } from '@/lib/api/products';
import { listSellers } from '@/lib/api/sellers';
import { getCategoryTree } from '@/lib/api/categories';
import { listCollections } from '@/lib/api/collections';
import { listAttributes } from '@/lib/api/attributes';
import { flattenCategoryTree } from '@/lib/category-tree';
import { ApiError } from '@/lib/api/http';
import { useToast } from '@/components/ui/toast';
import {
  buildCreateSkus,
  emptySkuDraft,
  ProductSkuEditor,
  validateSkuDrafts,
  type SkuDraft,
} from './product-sku-editor';
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
  isPublished: boolean;
  isActive: boolean;
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
  isPublished: true,
  isActive: true,
  seoTitle: '',
  seoDescription: '',
};

const fieldClass =
  'mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none';

export function ProductCreateForm() {
  const router = useRouter();
  const { showToast } = useToast();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [skus, setSkus] = useState<SkuDraft[]>(() => [emptySkuDraft(true)]);
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
  const thumbnailPreview = useMemo(
    () => (thumbnail ? URL.createObjectURL(thumbnail) : null),
    [thumbnail],
  );

  useEffect(() => {
    listSellers({ status: 'approved', activeStatus: 'active', limit: 100 })
      .then((response) => setSellers(response.results))
      .catch(() => showToast('Failed to load sellers.', 'error'));
    getCategoryTree()
      .then(setTree)
      .catch(() => showToast('Failed to load categories.', 'error'));
    listCollections({ isActive: true, limit: 100 })
      .then((response) => setCollections(response.results))
      .catch(() => showToast('Failed to load collections.', 'error'));
    listAttributes({ isActive: true, limit: 100 })
      .then((response) => setAttributes(response.results))
      .catch(() => showToast('Failed to load attributes.', 'error'));
  }, [showToast]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNameError(null);
    setSellerError(null);
    setGeneralError(null);

    if (!form.name.trim()) return setNameError('Name is required.');
    if (!form.sellerId) return setSellerError('Seller is required.');
    if (!form.categoryId) return setGeneralError('Category is required.');
    const skuError = validateSkuDrafts(skus);
    if (skuError) return setGeneralError(skuError);

    setSubmitting(true);
    let createdId: number | null = null;
    try {
      const product = await createProduct({
        sellerId: Number(form.sellerId),
        categoryId: Number(form.categoryId),
        collectionId: form.collectionId ? Number(form.collectionId) : undefined,
        name: form.name,
        description: form.description || undefined,
        isFeatured: form.isFeatured,
        isPublished: form.isPublished,
        isActive: form.isActive,
        seoTitle: form.seoTitle || undefined,
        seoDescription: form.seoDescription || undefined,
        skus: buildCreateSkus(skus),
      });
      createdId = product.id;

      if (thumbnail || gallery.length > 0) {
        await updateProductMediaFiles(product.id, {
          thumbnailImage: thumbnail,
          mediaFiles: gallery,
        });
      }
      showToast('Product created.', 'success');
      router.push(`/admin/catalog/products/${product.id}`);
    } catch (error) {
      if (createdId !== null) {
        showToast('Product created, but uploading media failed. Add it from the edit page.', 'error');
        router.push(`/admin/catalog/products/${createdId}/edit`);
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
        <Link href="/admin/catalog/products" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
      </div>

      {generalError && (
        <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{generalError}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm text-foreground">
              Seller *
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

            <label className="text-sm text-foreground">
              Category *
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
              Name *
              <input
                className={`${fieldClass} ${nameError ? 'border-destructive' : ''}`}
                value={form.name}
                onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
              />
              {nameError && <p className="mt-1 text-xs text-destructive">{nameError}</p>}
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

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(event) => setForm((f) => ({ ...f, isFeatured: event.target.checked }))}
              />
              Featured
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(event) => setForm((f) => ({ ...f, isPublished: event.target.checked }))}
              />
              Published
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm((f) => ({ ...f, isActive: event.target.checked }))}
              />
              Active
            </label>

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
          <h2 className="mb-3 font-semibold text-foreground">SKUs</h2>
          <ProductSkuEditor drafts={skus} onChange={setSkus} attributes={attributes} />
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-foreground">Media (optional)</h2>
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
