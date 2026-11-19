'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { clearAdminToken } from '@/lib/auth/admin-token';

export function AdminTopbar() {
  const router = useRouter();

  function handleLogout() {
    clearAdminToken();
    router.replace('/admin/login');
  }

  return (
    <header className="fixed inset-x-0 top-0 left-56 z-10 flex h-16 items-center justify-between border-b border-border bg-card px-6 shadow-sm">
      <span className="text-sm font-medium text-muted-foreground">Admin Console</span>
      <button
        type="button"
        onClick={handleLogout}
        className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </header>
  );
}
