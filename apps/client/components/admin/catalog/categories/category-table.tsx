'use client';

import Link from 'next/link';
import type { Category, CategoryTreeNode } from '@/types/category';
import { findAncestorNames } from '@/lib/category-tree';

export function CategoryTable({
  categories,
  tree,
  onToggleActive,
}: {
  categories: Category[];
  tree: CategoryTreeNode[];
  onToggleActive: (category: Category) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Image</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Slug</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Parent</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Sort</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {categories.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                No categories found.
              </td>
            </tr>
          )}
          {categories.map((category) => {
            const ancestors = findAncestorNames(tree, category.id);
            return (
              <tr key={category.id} className="border-t border-border">
                <td className="px-4 py-3">
                  {category.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={category.imageUrl}
                      alt=""
                      className="h-10 w-10 rounded-md border border-border object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                      —
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-foreground">{category.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{category.slug}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {ancestors.length > 0 ? `${ancestors.join(' → ')} → ` : ''}
                  <span className="text-foreground">{category.name}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{category.sortOrder}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onToggleActive(category)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      category.isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {category.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/catalog/categories/${category.id}`}
                    className="font-medium text-primary hover:opacity-70"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
