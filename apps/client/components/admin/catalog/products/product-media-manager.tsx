'use client';

import { useMemo, useState } from 'react';
import { adminProductPortal, type ProductPortal } from '@/lib/products/portal';
import { ApiError } from '@/lib/api/http';
import { useToast } from '@/components/ui/toast';
import type { Product, ProductMedia } from '@/types/product';

// Thumbnail + gallery, saved together through PATCH /products/:id/media-files.
export function ProductMediaManager({
  product,
  portal = adminProductPortal,
}: {
  product: Product;
  portal?: ProductPortal;
}) {
  const { showToast } = useToast();

  const [thumbnailUrl, setThumbnailUrl] = useState(product.thumbnailUrl);
  const [media, setMedia] = useState<ProductMedia[]>(product.media ?? []);

  const [newThumbnail, setNewThumbnail] = useState<File | null>(null);
  const [removeThumbnail, setRemoveThumbnail] = useState(false);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [removeIds, setRemoveIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const newThumbnailPreview = useMemo(
    () => (newThumbnail ? URL.createObjectURL(newThumbnail) : null),
    [newThumbnail],
  );

  const hasChanges =
    newThumbnail !== null || removeThumbnail || newFiles.length > 0 || removeIds.size > 0;

  function toggleRemoveId(id: number) {
    setRemoveIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await portal.updateMedia(product.id, {
        thumbnailImage: newThumbnail,
        removeThumbnail,
        mediaFiles: newFiles,
        removeMediaFilesIds: [...removeIds],
      });
      setThumbnailUrl(updated.thumbnailUrl);
      setMedia(updated.media ?? []);
      setNewThumbnail(null);
      setRemoveThumbnail(false);
      setNewFiles([]);
      setRemoveIds(new Set());
      showToast('Media updated.', 'success');
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Failed to update media.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const shownThumbnail = removeThumbnail ? null : (newThumbnailPreview ?? thumbnailUrl);

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Media</h2>
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save media'}
        </button>
      </div>

      <div className="mb-5">
        <span className="text-sm font-medium text-foreground">Thumbnail</span>
        <div className="mt-2 flex items-center gap-4">
          {shownThumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shownThumbnail} alt="" className="h-20 w-20 rounded-lg border border-border object-cover" />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
              None
            </span>
          )}
          <div className="flex flex-col items-start gap-2">
            <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
              {thumbnailUrl || newThumbnail ? 'Replace' : 'Upload'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  setNewThumbnail(event.target.files?.[0] ?? null);
                  setRemoveThumbnail(false);
                  event.target.value = '';
                }}
              />
            </label>
            {newThumbnail && (
              <button type="button" onClick={() => setNewThumbnail(null)} className="text-xs text-muted-foreground">
                Discard new thumbnail
              </button>
            )}
            {thumbnailUrl && !newThumbnail && (
              <label className="flex items-center gap-1 text-xs text-destructive">
                <input
                  type="checkbox"
                  checked={removeThumbnail}
                  onChange={(event) => setRemoveThumbnail(event.target.checked)}
                />
                Remove thumbnail
              </label>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Gallery ({media.length})</span>
          <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
            Add files
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(event) => {
                const picked = Array.from(event.target.files ?? []);
                setNewFiles((current) => [...current, ...picked]);
                event.target.value = '';
              }}
            />
          </label>
        </div>

        {media.length === 0 && newFiles.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">No media yet.</p>
        )}

        {media.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {media.map((item) => {
              const marked = removeIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`relative overflow-hidden rounded-lg border ${
                    marked ? 'border-destructive opacity-50' : 'border-border'
                  }`}
                >
                  {item.type === 'video' ? (
                    <video src={item.url} className="aspect-square w-full object-cover" muted />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt="" className="aspect-square w-full object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => toggleRemoveId(item.id)}
                    className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-[10px] font-medium text-white hover:underline"
                  >
                    {marked ? 'Undo remove' : 'Remove'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {newFiles.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {newFiles.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center justify-between">
                <span className="truncate">+ {file.name}</span>
                <button
                  type="button"
                  onClick={() => setNewFiles((current) => current.filter((_, i) => i !== index))}
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
  );
}
