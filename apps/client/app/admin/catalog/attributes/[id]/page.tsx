'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AttributeForm } from '@/components/admin/catalog/attributes/attribute-form';
import { listAttributes } from '@/lib/api/attributes';
import { useToast } from '@/components/ui/toast';
import type { Attribute } from '@/types/attribute';

export default function EditAttributePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [attribute, setAttribute] = useState<Attribute | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const targetId = Number(params.id);
      let cursor: number | undefined;
      // Walk cursor pages (100 at a time, the server's max) until found.
      for (;;) {
        const response = await listAttributes({ limit: 100, cursor });
        const found = response.results.find((row) => row.id === targetId);
        if (found) return found;
        if (response.nextCursor === null) return null;
        cursor = response.nextCursor;
      }
    }

    load()
      .then((found) => {
        if (!found) {
          showToast('That attribute no longer exists.', 'error');
          router.replace('/admin/catalog/attributes');
          return;
        }
        setAttribute(found);
      })
      .catch(() => {
        showToast('Failed to load attribute.', 'error');
        router.replace('/admin/catalog/attributes');
      })
      .finally(() => setLoading(false));
  }, [params.id, router, showToast]);

  if (loading) {
    return <p className="py-10 text-center text-muted-foreground">Loading…</p>;
  }
  if (!attribute) return null;

  return <AttributeForm attribute={attribute} key={attribute.id} />;
}
