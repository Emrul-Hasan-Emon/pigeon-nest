import { BreadcrumbProvider } from '@/components/ui/breadcrumbs';
import { ToastProvider } from '@/components/ui/toast';
import { AdminAuthGuard } from '@/components/admin/auth-guard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      <ToastProvider>
        <BreadcrumbProvider>
          <AdminAuthGuard>{children}</AdminAuthGuard>
        </BreadcrumbProvider>
      </ToastProvider>
    </div>
  );
}
