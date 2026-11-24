import { SellerChrome } from '@/components/seller/seller-chrome';
import { BreadcrumbProvider } from '@/components/ui/breadcrumbs';
import { ToastProvider } from '@/components/ui/toast';

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="seller-shell">
      <ToastProvider>
        <BreadcrumbProvider>
          <SellerChrome>{children}</SellerChrome>
        </BreadcrumbProvider>
      </ToastProvider>
    </div>
  );
}
