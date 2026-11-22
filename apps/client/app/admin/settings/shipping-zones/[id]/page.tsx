'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ZoneForm } from '@/components/admin/settings/shipping/zone-form';
import { getZone } from '@/lib/api/shipping';
import { useToast } from '@/components/ui/toast';
import type { ShippingZone } from '@/types/shipping';
import { LoadingBlock } from '@/components/ui/skeleton';

export default function EditZonePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [zone, setZone] = useState<ShippingZone | null>(null);

  useEffect(() => {
    getZone(Number(params.id))
      .then(setZone)
      .catch(() => {
        showToast('That zone no longer exists.', 'error');
        router.replace('/admin/settings/shipping-zones');
      });
  }, [params.id, router, showToast]);

  if (!zone) return <LoadingBlock />;
  return <ZoneForm zone={zone} />;
}
