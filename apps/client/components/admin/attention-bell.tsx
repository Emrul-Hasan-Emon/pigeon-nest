'use client';

import { AttentionBell } from '@/components/ui/attention-bell';
import { getAdminAttention } from '@/lib/api/dashboard';
import { adminTodoItems } from '@/components/dashboard/admin-todo';

export function AdminAttentionBell() {
  return <AttentionBell load={getAdminAttention} items={adminTodoItems} />;
}
