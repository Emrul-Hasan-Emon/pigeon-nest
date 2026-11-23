import { ToastProvider } from '@/components/ui/toast';

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="seller-shell">
      <ToastProvider>{children}</ToastProvider>
    </div>
  );
}
