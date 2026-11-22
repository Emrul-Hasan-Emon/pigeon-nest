'use client';

import { SellerShell } from '@/components/orders/ui';
import { DashboardGuide } from '@/components/dashboard/guide';
import { SELLER_GUIDE } from '@/components/dashboard/guide-content';

export default function SellerDashboardGuidePage() {
  return (
    <SellerShell active="dashboard-guide">
      <DashboardGuide
        title="Dashboard guide"
        intro="What every figure on your dashboard means and how it is worked out."
        sections={SELLER_GUIDE}
        backHref="/seller/dashboard"
      />
    </SellerShell>
  );
}
