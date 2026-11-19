'use client';

import Link from 'next/link';
import type { Collection } from '@/types/collection';

export function CollectionTable({
  collections,
  onToggleActive,
  onDelete,
}: {
  collections: Collection[];
  onToggleActive: (collection: Collection) => void;
  onDelete: (collection: Collection) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Image</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Slug</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Color</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Sort</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {collections.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                No collections found.
              </td>
            </tr>
          )}
          {collections.map((collection) => (
            <tr key={collection.id} className="border-t border-border">
              <td className="px-4 py-3">
                {collection.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={collection.imageUrl}
                    alt=""
                    className="h-10 w-10 rounded-md border border-border object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                    —
                  </span>
                )}
              </td>
              <td className="px-4 py-3 font-medium text-foreground">{collection.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{collection.slug}</td>
              <td className="px-4 py-3">
                {collection.colorCode ? (
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-4 w-4 rounded-full border border-border"
                      style={{ backgroundColor: collection.colorCode }}
                    />
                    <span className="text-muted-foreground">{collection.colorCode}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{collection.sortOrder}</td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onToggleActive(collection)}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    collection.isActive
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {collection.isActive ? 'Active' : 'Inactive'}
                </button>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-3">
                  <Link
                    href={`/admin/catalog/collections/${collection.id}`}
                    className="font-medium text-primary hover:opacity-70"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => onDelete(collection)}
                    className="font-medium text-destructive hover:opacity-70"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
