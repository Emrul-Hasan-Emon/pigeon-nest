import { http, sellerHttp } from './http';
import { ENDPOINTS } from '../endpoints';
import type { CommissionChangeRow } from '@/types/returns';
import type {
  BalanceDetail,
  BalanceRow,
  CommissionRole,
  CommissionType,
  DisburseDetail,
  DisburseRow,
  LedgerRow,
  Page,
  RuleView,
  SettingHistoryRow,
} from '@/types/commission';

type Params = Record<string, string | number | boolean | undefined>;

/** Admin and seller read the same shapes; the server limits a seller to their own rows. */
export function commissionApi(role: CommissionRole) {
  const client = role === 'admin' ? http : sellerHttp;
  const a = ENDPOINTS.admin.commission;
  const s = ENDPOINTS.seller.commission;
  return {
    ledger: (params: Params) => client.get<Page<LedgerRow>>(role === 'admin' ? a.history : s.history, { ...params }),
    changes: (params: Params) => client.get<Page<CommissionChangeRow>>(role === 'admin' ? a.changes : s.changes, { ...params }),
    disbursements: (params: Params) =>
      client.get<Page<DisburseRow>>(role === 'admin' ? a.disbursements.list : s.disbursements.list, { ...params }),
    disbursement: (id: number) =>
      client.get<DisburseDetail>(role === 'admin' ? a.disbursements.detail(id) : s.disbursements.detail(id)),
    settingHistory: (params: Params) =>
      client.get<Page<SettingHistoryRow>>(role === 'admin' ? a.settingHistory : s.settingHistory, { ...params }),
  };
}

export const adminCommission = {
  balances: (params: Params) => http.get<Page<BalanceRow>>(ENDPOINTS.admin.commission.balances, { ...params }),
  balance: (sellerId: number) => http.get<BalanceDetail>(ENDPOINTS.admin.commission.balance(sellerId)),
  disburse: (sellerId: number, fields: { amount: string; notes?: string }, files: File[]) => {
    const body = new FormData();
    body.append('amount', fields.amount);
    if (fields.notes) body.append('notes', fields.notes);
    for (const file of files) body.append('files', file);
    return http.post<{ disburseId: number; sellerId: number }>(ENDPOINTS.admin.commission.disburse(sellerId), body);
  },
  setRule: (sellerId: number, commissionType: CommissionType, commissionAmount: number, note?: string) =>
    http.put<RuleView>(ENDPOINTS.admin.commission.rule(sellerId), {
      commissionType,
      commissionAmount,
      ...(note ? { note } : {}),
    }),
};

export const sellerCommission = {
  balance: () => sellerHttp.get<BalanceDetail>(ENDPOINTS.seller.commission.balance),
};
