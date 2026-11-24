import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { tidy } from '../../shared/utils/money.util';
import { dayKey } from '../utils/report-range.util';

/**
 * A seller's monthly statement: what they sold, what the marketplace charged (system commission), refunds, what they
 * paid the marketplace, and what they owe at the start and end of the month. The same numbers as the reports and the
 * commission ledger, written as one document that can be printed.
 */
@Injectable()
export class StatementService {
  constructor(private readonly dataSource: DataSource) {}

  async forSeller(sellerId: number, month?: string) {
    const now = new Date();
    const [y, m] = (month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`).split('-').map(Number);
    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m, 1);
    const [seller] = await this.dataSource.query<{ id: number; name: string; phone: string | null }[]>(`select id, name, phone from seller where id = $1 and "deletedAt" is null`, [sellerId]);
    if (!seller) throw new NotFoundException('Seller not found');

    const PAID = `o."paymentStatus" = 'paid' and o.status <> 'cancelled'`;
    const [orders, returns, payments, opening, closing] = await Promise.all([
      this.dataSource.query<{ id: number; orderNumber: string; createdAt: Date; amount: number; commission: number; keep: number }[]>(
        `select o.id, o."orderNumber", o."createdAt", o."payableAmount" amount, o."systemCommission" commission, o."sellerAmount" keep
           from "order" o where o."deletedAt" is null and ${PAID} and o."sellerId" = $1 and o."createdAt" >= $2 and o."createdAt" < $3
          order by o.id limit 500`,
        [sellerId, from, to],
      ),
      this.dataSource.query<{ id: number; returnNumber: string; returnedAt: Date; refund: number; back: number }[]>(
        `select id, "returnNumber", "returnedAt", "refundAmount" refund, "commissionAmount" back from order_return
          where "deletedAt" is null and status = 'returned' and "sellerId" = $1 and "returnedAt" >= $2 and "returnedAt" < $3 order by "returnedAt", id`,
        [sellerId, from, to],
      ),
      this.dataSource.query<{ id: number; createdAt: Date; amount: number; notes: string | null }[]>(
        `select id, "createdAt", amount, notes from system_commission_disburse where "deletedAt" is null and "sellerId" = $1 and "createdAt" >= $2 and "createdAt" < $3 order by id`,
        [sellerId, from, to],
      ),
      this.dataSource.query<{ due: number }[]>(`select "dueAfter" due from system_commission_history where "sellerId" = $1 and "deletedAt" is null and "createdAt" < $2 order by id desc limit 1`, [sellerId, from]),
      this.dataSource.query<{ due: number }[]>(`select "dueAfter" due from system_commission_history where "sellerId" = $1 and "deletedAt" is null and "createdAt" < $2 order by id desc limit 1`, [sellerId, to]),
    ]);

    const sum = <T,>(rows: T[], f: (r: T) => number) => tidy(rows.reduce((t, r) => t + Number(f(r)), 0));
    const sales = sum(orders, (o) => o.amount);
    const commission = sum(orders, (o) => o.commission);
    const refunds = sum(returns, (r) => r.refund);
    const commissionBack = sum(returns, (r) => r.back);
    const kept = sum(orders, (o) => o.keep);
    const paid = sum(payments, (p) => p.amount);
    const day = (d: Date) => dayKey(new Date(d));
    return {
      seller,
      month: `${y}-${String(m).padStart(2, '0')}`,
      from: dayKey(from),
      to: dayKey(new Date(y, m, 0)),
      generatedAt: new Date().toISOString(),
      summary: {
        paidOrders: orders.length,
        sales,
        systemCommission: commission,
        refunds,
        systemCommissionGivenBack: commissionBack,
        netSystemCommission: tidy(commission - commissionBack),
        // The seller's share of paid orders, less what refunds cost them after commission came back.
        youKeep: tidy(kept - (refunds - commissionBack)),
        paidToMarketplace: paid,
        owedAtStart: tidy(Number(opening[0]?.due ?? 0)),
        owedAtEnd: tidy(Number(closing[0]?.due ?? opening[0]?.due ?? 0)),
      },
      orders: orders.map((o) => ({ id: o.id, orderNumber: o.orderNumber, date: day(o.createdAt), amount: tidy(Number(o.amount)), systemCommission: tidy(Number(o.commission)), youKeep: tidy(Number(o.keep)) })),
      refunds: returns.map((r) => ({ id: r.id, returnNumber: r.returnNumber, date: day(r.returnedAt), refund: tidy(Number(r.refund)), systemCommissionGivenBack: tidy(Number(r.back)) })),
      payments: payments.map((p) => ({ id: p.id, date: day(p.createdAt), amount: tidy(Number(p.amount)), note: p.notes })),
    };
  }
}
