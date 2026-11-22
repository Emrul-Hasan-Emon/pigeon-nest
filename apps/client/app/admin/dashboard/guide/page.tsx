import { DashboardGuide } from '@/components/dashboard/guide';
import { ADMIN_GUIDE } from '@/components/dashboard/guide-content';

export default function AdminDashboardGuidePage() {
  return (
    <DashboardGuide
      title="Dashboard guide"
      intro="What every figure on the admin dashboard means and how it is worked out."
      sections={ADMIN_GUIDE}
      backHref="/admin/dashboard"
    />
  );
}
