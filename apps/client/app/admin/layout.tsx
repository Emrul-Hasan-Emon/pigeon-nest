import { ToastProvider } from '@/components/ui/toast';
import { AdminAuthGuard } from '@/components/admin/auth-guard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AdminAuthGuard>{children}</AdminAuthGuard>
    </ToastProvider>
  );
}
