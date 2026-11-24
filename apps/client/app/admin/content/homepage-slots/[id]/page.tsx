'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SectionForm } from '@/components/admin/content/homepage/section-form';
import { getHomepageSlot } from '@/lib/api/homepage';
import { useToast } from '@/components/ui/toast';
import type { HomepageSectionDetail } from '@/types/homepage';
import { LoadingBlock } from '@/components/ui/skeleton';
import { useBreadcrumbTitle } from '@/components/ui/breadcrumbs';

export default function EditHomepageSlotPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [section, setSection] = useState<HomepageSectionDetail | null>(null);
  useBreadcrumbTitle(section?.title);

  useEffect(() => {
    getHomepageSlot(Number(params.id))
      .then(setSection)
      .catch(() => {
        showToast('That slot no longer exists.', 'error');
        router.replace('/admin/content/homepage-slots');
      });
  }, [params.id, router, showToast]);

  if (!section) return <LoadingBlock />;
  return <SectionForm mode="slot" section={section} />;
}
