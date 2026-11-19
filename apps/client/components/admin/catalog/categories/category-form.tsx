'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createCategory, getCategoryTree, updateCategory } from '@/lib/api/categories';
import { flattenCategoryTree } from '@/lib/category-tree';
import { ApiError, NotFoundApiError } from '@/lib/api/http';
import { useToast } from '@/components/ui/toast';
import type { Category, CategoryTreeNode } from '@/types/category';

interface FormState {
  name: string;
  description: string;
  parentId: string;
  sortOrder: number;
  isActive: boolean;
  image: File | null;
}

function toFormState(category?: Category): FormState {
  return {
    name: category?.name ?? '',
    description: category?.description ?? '',
    parentId: category?.parentId ? String(category.parentId) : '',
    sortOrder: category?.sortOrder ?? 0,
    isActive: category?.isActive ?? true,
    image: null,
  };
}

export function CategoryForm({ category }: { category?: Category }) {
  const router = useRouter();
  const { showToast } = useToast();
  const isEdit = category !== undefined;

  const initial = useMemo(() => toFormState(category), [category]);
  const [form, setForm] = useState<FormState>(initial);
  const [tree, setTree] = useState<CategoryTreeNode[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(category?.imageUrl ?? null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [parentError, setParentError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getCategoryTree()
      .then(setTree)
      .catch(() => showToast('Failed to load category tree.', 'error'));
  }, [showToast]);

  const treeOptions = useMemo(
    () => flattenCategoryTree(tree, category?.id),
    [tree, category?.id],
  );

  function onImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setForm((f) => ({ ...f, image: file }));
    setImagePreview(file ? URL.createObjectURL(file) : (category?.imageUrl ?? null));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNameError(null);
    setParentError(null);
    setGeneralError(null);

    if (!form.name.trim()) {
      setNameError('Name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const parentId = form.parentId ? Number(form.parentId) : null;

      if (isEdit) {
        const payload: Record<string, unknown> = {};
        if (form.name !== initial.name) payload.name = form.name;
        if (form.description !== initial.description) {
          payload.description = form.description || null;
        }
        if (parentId !== category!.parentId) payload.parentId = parentId;
        if (form.sortOrder !== initial.sortOrder) payload.sortOrder = form.sortOrder;
        if (form.isActive !== initial.isActive) payload.isActive = form.isActive;
        if (form.image) payload.image = form.image;

        if (Object.keys(payload).length > 0) {
          await updateCategory(category!.id, payload);
        }
      } else {
        await createCategory({
          name: form.name,
          description: form.description || null,
          parentId,
          sortOrder: form.sortOrder,
          isActive: form.isActive,
          image: form.image,
        });
      }
      showToast(isEdit ? 'Category updated.' : 'Category created.', 'success');
      router.push('/admin/catalog/categories');
    } catch (error) {
      if (error instanceof NotFoundApiError) {
        showToast('That category no longer exists.', 'error');
        router.push('/admin/catalog/categories');
        return;
      }
      if (error instanceof ApiError) {
        const message = error.message.toLowerCase();
        if (message.includes('name')) {
          setNameError(error.message);
        } else if (message.includes('parent') || message.includes('circular')) {
          setParentError(error.message);
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
          {isEdit ? 'Edit category' : 'Add category'}
        </h1>
        <Link href="/admin/catalog/categories" className="text-sm text-muted-foreground hover:text-foreground">
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
            Parent category
            <select
              className={`mt-1 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none ${
                parentError ? 'border-destructive' : 'border-input'
              }`}
              value={form.parentId}
              onChange={(event) => setForm((f) => ({ ...f, parentId: event.target.value }))}
            >
              <option value="">— Root (no parent) —</option>
              {treeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {'—'.repeat(option.depth)} {option.name}
                </option>
              ))}
            </select>
            {parentError && <p className="mt-1 text-xs text-destructive">{parentError}</p>}
          </label>

          <label className="text-sm text-foreground md:col-span-2">
            Description
            <textarea
              className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
              rows={3}
              value={form.description}
              onChange={(event) =>
                setForm((f) => ({ ...f, description: event.target.value }))
              }
            />
          </label>

          <label className="text-sm text-foreground">
            Sort order
            <input
              type="number"
              className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
              value={form.sortOrder}
              onChange={(event) =>
                setForm((f) => ({ ...f, sortOrder: Number(event.target.value) }))
              }
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-foreground md:pt-6">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                setForm((f) => ({ ...f, isActive: event.target.checked }))
              }
            />
            Active
          </label>
        </div>

        <div className="mt-5">
          <span className="text-sm font-medium text-foreground">Cover image</span>
          <div className="mt-2 flex items-start gap-4 rounded-lg border border-dashed border-border p-4">
            {imagePreview ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt=""
                  className="h-24 w-24 rounded-lg border border-border object-cover"
                />
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-center text-xs font-medium text-foreground hover:bg-muted">
                    Change image
                    <input type="file" accept="image/*" className="hidden" onChange={onImageChange} />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForm((f) => ({ ...f, image: null }));
                      setImagePreview(null);
                    }}
                    className="text-left text-xs text-destructive"
                  >
                    Remove image
                  </button>
                </div>
              </>
            ) : (
              <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-1 py-6 text-center text-sm text-muted-foreground">
                <input type="file" accept="image/*" className="hidden" onChange={onImageChange} />
                Click to upload a cover image (JPG / PNG / WEBP)
              </label>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Saving…' : isEdit ? 'Update category' : 'Create category'}
        </button>
      </form>
    </div>
  );
}
