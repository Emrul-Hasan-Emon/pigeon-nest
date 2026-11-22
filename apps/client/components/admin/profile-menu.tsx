'use client';

import { useRouter } from 'next/navigation';
import { ProfileMenu } from '@/components/ui/profile-menu';
import { getAdminMe } from '@/lib/api/auth';
import { clearAdminToken } from '@/lib/auth/admin-token';

const roleLabel = (role: string) => role.replace(/[_-]/g, ' ').replace(/^./, (c) => c.toUpperCase());

export function AdminProfileMenu() {
  const router = useRouter();
  return (
    <ProfileMenu
      fallbackName="Admin"
      load={() => getAdminMe().then((m) => ({ name: m.name, email: m.email, role: roleLabel(m.role) }))}
      onLogout={() => {
        clearAdminToken();
        router.replace('/admin/login');
      }}
    />
  );
}
