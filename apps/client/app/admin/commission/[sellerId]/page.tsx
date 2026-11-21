'use client';

import { useParams } from 'next/navigation';
import { SellerCommissionAdmin } from '@/components/commission/seller-commission-admin';

export default function SellerCommissionPage() {
  const params = useParams<{ sellerId: string }>();
  return <SellerCommissionAdmin sellerId={Number(params.sellerId)} />;
}
