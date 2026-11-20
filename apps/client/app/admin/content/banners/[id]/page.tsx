'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BannerForm } from '@/components/admin/content/banners/banner-form';
import { getBanner } from '@/lib/api/banners';
import { useToast } from '@/components/ui/toast';
import type { Banner } from '@/types/banner';

export default function EditBannerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [banner, setBanner] = useState<Banner | null>(null);

  useEffect(() => {
    getBanner(Number(params.id))
      .then(setBanner)
      .catch(() => {
        showToast('That banner no longer exists.', 'error');
        router.replace('/admin/content/banners');
      });
  }, [params.id, router, showToast]);

  if (!banner) return <p className="py-10 text-center text-muted-foreground">Loading…</p>;
  return <BannerForm banner={banner} />;
}
