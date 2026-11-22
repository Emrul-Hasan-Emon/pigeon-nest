'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CategoryForm } from '@/components/admin/catalog/categories/category-form';
import { getCategoryTree } from '@/lib/api/categories';
import { findCategoryNode } from '@/lib/category-tree';
import { useToast } from '@/components/ui/toast';
import type { Category } from '@/types/category';
import { LoadingBlock } from '@/components/ui/skeleton';

export default function EditCategoryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCategoryTree()
      .then((tree) => {
        const found = findCategoryNode(tree, Number(params.id));
        if (!found) {
          showToast('That category no longer exists.', 'error');
          router.replace('/admin/catalog/categories');
          return;
        }
        setCategory(found);
      })
      .catch(() => {
        showToast('Failed to load category.', 'error');
        router.replace('/admin/catalog/categories');
      })
      .finally(() => setLoading(false));
  }, [params.id, router, showToast]);

  if (loading) {
    return <LoadingBlock />;
  }
  if (!category) return null;

  return <CategoryForm category={category} />;
}
