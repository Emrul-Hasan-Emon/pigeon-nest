import { ToastProvider } from '@/components/ui/toast';

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
