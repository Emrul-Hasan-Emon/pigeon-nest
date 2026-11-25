import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Seller } from '../seller/seller.entity';
import { Order } from '../order/order.entity';
import { OrderItem } from '../order/order-item.entity';
import { OrderReturn } from '../order-return/order-return.entity';
import { CommissionStatus } from '../../enums/commission-status.enum';
import { CommissionHistoryType } from '../../enums/commission-history-type.enum';
import { CommissionType } from '../../enums/commission-type.enum';
import { SystemCommissionDisburse } from './system-commission-disburse.entity';
import { DEFAULT_CURRENCY } from '../../enums/currency';

// The ledger. One row per commission earned from an order, one per payment the
// seller made. An order row is soft-deleted (deletedAt) when its payment is
// reversed or the order is cancelled, and the balance is corrected in the same
// transaction. The balance after each event is kept on the row.
@Entity('system_commission_history')
@Index('UQ_system_commission_history_live_order', ['orderId'], {
  unique: true,
  where: `"type" = 'order_commission' AND "deletedAt" IS NULL`,
})
export class SystemCommissionHistory extends BaseEntity {
  // ISO 4217 code of every amount on this row.
  @Column({ type: 'char', length: 3, default: DEFAULT_CURRENCY })
  currency: string;

  @Index('IDX_system_commission_history_sellerId')
  @Column()
  sellerId: number;

  @ManyToOne(() => Seller, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sellerId', foreignKeyConstraintName: 'FK_system_commission_history_sellerId' })
  seller: Seller;

  @Index('IDX_system_commission_history_orderId')
  @Column({ type: 'int', nullable: true })
  orderId: number | null;

  @ManyToOne(() => Order, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'orderId', foreignKeyConstraintName: 'FK_system_commission_history_orderId' })
  order: Order | null;

  @Index('IDX_system_commission_history_disburseId')
  @Column({ type: 'int', nullable: true })
  disburseId: number | null;

  @ManyToOne(() => SystemCommissionDisburse, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'disburseId', foreignKeyConstraintName: 'FK_system_commission_history_disburseId' })
  disburse: SystemCommissionDisburse | null;

  @Index('IDX_system_commission_history_type')
  @Column({ type: 'varchar', length: 30 })
  type: CommissionHistoryType;

  // The commission earned (order row) or the amount paid (payment row).
  @Column({ type: 'double precision' })
  totalAmount: number;

  // Order rows: what the commission was worked out from.
  @Column({ type: 'double precision', nullable: true })
  orderSubtotal: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  commissionType: CommissionType | null;

  @Column({ type: 'double precision', nullable: true })
  commissionValue: number | null;

  // Return rows: the item the commission was taken back for (empty for a whole-order return).
  @Index('IDX_system_commission_history_orderItemId')
  @Column({ type: 'int', nullable: true })
  orderItemId: number | null;

  @ManyToOne(() => OrderItem, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'orderItemId', foreignKeyConstraintName: 'FK_system_commission_history_orderItemId' })
  orderItem: OrderItem | null;

  @Index('IDX_system_commission_history_orderReturnId')
  @Column({ type: 'int', nullable: true })
  orderReturnId: number | null;

  @ManyToOne(() => OrderReturn, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'orderReturnId', foreignKeyConstraintName: 'FK_system_commission_history_orderReturnId' })
  orderReturn: OrderReturn | null;

  // for_system: earned by the system. order_returned_to_customer: taken back on a return.
  @Index('IDX_system_commission_history_status')
  @Column({ type: 'varchar', length: 40, default: CommissionStatus.FOR_SYSTEM })
  status: CommissionStatus;

  // The order's payment status when the row was written ('paid' for payments).
  @Index('IDX_system_commission_history_paymentStatus')
  @Column({ type: 'varchar', length: 30 })
  paymentStatus: string;

  // The seller's balance right after this event.
  @Column({ type: 'double precision' })
  totalAfter: number;

  @Column({ type: 'double precision' })
  dueAfter: number;

  @Column({ type: 'double precision' })
  paidAfter: number;

  // Why a row was voided (set together with deletedAt).
  @Column({ type: 'text', nullable: true })
  voidReason: string | null;
}
