'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getAdminToken } from '@/lib/auth/admin-token';
import { AdminSidebar } from './sidebar';
import { AdminTopbar } from './topbar';

const LOGIN_PATH = '/admin/login';

export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (pathname === LOGIN_PATH) {
      setChecked(true);
      return;
    }
    if (!getAdminToken()) {
      router.replace(LOGIN_PATH);
      return;
    }
    setChecked(true);
  }, [pathname, router]);

  if (!checked) return null;

  if (pathname === LOGIN_PATH) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <AdminTopbar />
      <main className="admin-main ml-60 min-h-screen pt-16">
        <div className="mx-auto max-w-7xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
