'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GatewayForm } from '@/components/admin/settings/gateways/gateway-form';
import { getGateway } from '@/lib/api/payment-gateways';
import { useToast } from '@/components/ui/toast';
import type { PaymentGateway } from '@/types/payment-gateway';
import { LoadingBlock } from '@/components/ui/skeleton';

export default function EditGatewayPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [gateway, setGateway] = useState<PaymentGateway | null>(null);

  useEffect(() => {
    getGateway(Number(params.id))
      .then(setGateway)
      .catch(() => {
        showToast('That gateway no longer exists.', 'error');
        router.replace('/admin/settings/payment-gateways');
      });
  }, [params.id, router, showToast]);

  if (!gateway) return <LoadingBlock />;
  return <GatewayForm gateway={gateway} />;
}
