'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SectionForm } from '@/components/admin/content/homepage/section-form';
import { getHomepageSection } from '@/lib/api/homepage';
import { useToast } from '@/components/ui/toast';
import type { HomepageSectionDetail } from '@/types/homepage';

export default function EditHomepageSectionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [section, setSection] = useState<HomepageSectionDetail | null>(null);

  useEffect(() => {
    getHomepageSection(Number(params.id))
      .then(setSection)
      .catch(() => {
        showToast('That section no longer exists.', 'error');
        router.replace('/admin/content/homepage');
      });
  }, [params.id, router, showToast]);

  if (!section) return <p className="py-10 text-center text-muted-foreground">Loading…</p>;
  return <SectionForm mode="section" section={section} />;
}
