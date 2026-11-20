import { ToastProvider } from '@/components/ui/toast';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
