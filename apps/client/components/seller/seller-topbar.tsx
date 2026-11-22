'use client';

import { useRouter } from 'next/navigation';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { AttentionBell } from '@/components/ui/attention-bell';
import { ProfileMenu } from '@/components/ui/profile-menu';
import { sellerTodoItems } from '@/components/dashboard/seller-todo';
import { getSellerAttention } from '@/lib/api/dashboard';
import { getMyProfile } from '@/lib/api/seller-portal';
import { clearSellerToken } from '@/lib/auth/seller-token';

export function SellerTopbar() {
  const router = useRouter();
  return (
    <header className="fixed inset-x-0 top-0 left-56 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-card/85 px-6 backdrop-blur supports-[backdrop-filter]:bg-card/70">
      <Breadcrumbs rootLabel="Seller" rootPath="/seller" homeHref="/seller/dashboard" />
      <div className="flex shrink-0 items-center gap-1.5">
        <AttentionBell load={getSellerAttention} items={sellerTodoItems} />
        <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        <ProfileMenu
          fallbackName="Seller"
          load={() => getMyProfile().then((s) => ({ name: s.name, email: s.email ?? s.phone, role: null }))}
          onLogout={() => {
            clearSellerToken();
            router.replace('/seller/login');
          }}
        />
      </div>
    </header>
  );
}
