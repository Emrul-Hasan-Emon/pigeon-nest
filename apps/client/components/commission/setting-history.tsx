'use client';

import { useMemo } from 'react';
import { formatDateTime } from '@/lib/datetime';
import { commissionApi } from '@/lib/api/commission';
import type { CommissionRole, SettingHistoryRow } from '@/types/commission';
import { ListFrame, ruleLabel, td, th, usePagedList } from './parts';

/** Every change to a seller's settings: what changed, from what, to what, who and when. */
export function SettingHistory({ role, sellerId }: { role: CommissionRole; sellerId?: number }) {
  const api = useMemo(() => commissionApi(role), [role]);
  const list = usePagedList<SettingHistoryRow>(role, api.settingHistory, {}, { sellerId });
  const showSeller = role === 'admin' && sellerId === undefined;
  return (
    <ListFrame {...list}>
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted">
          <tr>
            <th className={th}>When</th>
            {showSeller && <th className={th}>Seller</th>}
            <th className={th}>Setting</th>
            <th className={th}>Before</th>
            <th className={th}>After</th>
            <th className={th}>Changed by</th>
            <th className={th}>Note</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {list.rows.length === 0 && <tr><td colSpan={showSeller ? 7 : 6} className="px-4 py-6 text-center text-muted-foreground">No changes yet.</td></tr>}
          {list.rows.map((h) => (
            <tr key={h.id}>
              <td className={`${td} text-muted-foreground`}>{formatDateTime(h.changedAt)}</td>
              {showSeller && <td className={td}>{h.sellerName}</td>}
              <td className={td}>Commission</td>
              <td className={`${td} text-muted-foreground`}>{h.fromValue ? ruleLabel({ type: h.fromValue.commissionType, value: h.fromValue.commissionAmount }) : 'Not set (global rate)'}</td>
              <td className={`${td} font-medium text-foreground`}>{ruleLabel({ type: h.toValue.commissionType, value: h.toValue.commissionAmount })}</td>
              <td className={`${td} text-muted-foreground`}>{h.changedByName ?? '—'}{h.changedByType ? ` (${h.changedByType})` : ''}</td>
              <td className={`${td} text-muted-foreground`}>{h.note ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ListFrame>
  );
}
