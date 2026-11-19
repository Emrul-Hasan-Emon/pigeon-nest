'use client';

import Link from 'next/link';
import type { Attribute } from '@/types/attribute';

export function AttributeTable({
  attributes,
  onToggleActive,
  onDelete,
}: {
  attributes: Attribute[];
  onToggleActive: (attribute: Attribute) => void;
  onDelete: (attribute: Attribute) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Slug</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Values</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {attributes.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                No attributes found.
              </td>
            </tr>
          )}
          {attributes.map((attribute) => (
            <tr key={attribute.id} className="border-t border-border">
              <td className="px-4 py-3 font-medium text-foreground">{attribute.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{attribute.slug}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {attribute.values.length === 0 && (
                    <span className="text-muted-foreground">—</span>
                  )}
                  {attribute.values.map((value) => (
                    <span
                      key={value.id}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-foreground"
                    >
                      {value.colorCode && (
                        <span
                          className="h-2.5 w-2.5 rounded-full border border-border"
                          style={{ backgroundColor: value.colorCode }}
                        />
                      )}
                      {value.name}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onToggleActive(attribute)}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    attribute.isActive
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {attribute.isActive ? 'Active' : 'Inactive'}
                </button>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-3">
                  <Link
                    href={`/admin/catalog/attributes/${attribute.id}`}
                    className="font-medium text-primary hover:opacity-70"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => onDelete(attribute)}
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
