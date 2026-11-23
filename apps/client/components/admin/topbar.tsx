'use client';

import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { AdminAttentionBell } from './attention-bell';
import { AdminProfileMenu } from './profile-menu';

export function AdminTopbar() {
  return (
    <header className="fixed inset-x-0 top-0 left-60 z-10 flex h-16 items-center justify-between gap-4 border-b border-border/80 bg-card/85 px-8 backdrop-blur supports-[backdrop-filter]:bg-card/70">
      <Breadcrumbs rootLabel="Admin" rootPath="/admin" homeHref="/admin/dashboard" />
      <div className="flex shrink-0 items-center gap-1.5">
        <AdminAttentionBell />
        <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        <AdminProfileMenu />
      </div>
    </header>
  );
}
