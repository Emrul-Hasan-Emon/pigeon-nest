'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CollectionForm } from '@/components/admin/catalog/collections/collection-form';
import { listCollections } from '@/lib/api/collections';
import { useToast } from '@/components/ui/toast';
import type { Collection } from '@/types/collection';

export default function EditCollectionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const targetId = Number(params.id);
      let cursor: number | undefined;
      // Walk cursor pages (100 at a time, the server's max) until found.
      for (;;) {
        const response = await listCollections({ limit: 100, cursor });
        const found = response.results.find((row) => row.id === targetId);
        if (found) return found;
        if (response.nextCursor === null) return null;
        cursor = response.nextCursor;
      }
    }

    load()
      .then((found) => {
        if (!found) {
          showToast('That collection no longer exists.', 'error');
          router.replace('/admin/catalog/collections');
          return;
        }
        setCollection(found);
      })
      .catch(() => {
        showToast('Failed to load collection.', 'error');
        router.replace('/admin/catalog/collections');
      })
      .finally(() => setLoading(false));
  }, [params.id, router, showToast]);

  if (loading) {
    return <p className="py-10 text-center text-muted-foreground">Loading…</p>;
  }
  if (!collection) return null;

  return <CollectionForm collection={collection} />;
}
