import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Seller } from '../seller/seller.entity';
import { SystemCommission } from './system-commission.entity';
import { SystemCommissionHistory } from './system-commission-history.entity';
import { CommissionStatus } from '../../enums/commission-status.enum';

// One row for every change to a seller's commission balance: what the three
// numbers were, what they became, and why. Append only: never edited or deleted,
// so the rows of a seller chain (each `new*` is the next row's `current*`).
@Entity('system_commission_change_history')
export class SystemCommissionChangeHistory extends BaseEntity {
  @Index('IDX_system_commission_change_history_systemCommissionId')
  @Column()
  systemCommissionId: number;

  @ManyToOne(() => SystemCommission, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'systemCommissionId',
    foreignKeyConstraintName: 'FK_system_commission_change_history_systemCommissionId',
  })
  systemCommission: SystemCommission;

  @Index('IDX_system_commission_change_history_sellerId')
  @Column()
  sellerId: number;

  @ManyToOne(() => Seller, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sellerId', foreignKeyConstraintName: 'FK_system_commission_change_history_sellerId' })
  seller: Seller;

  // The ledger row written in the same step, when there is one.
  @Index('IDX_system_commission_change_history_historyId')
  @Column({ type: 'int', nullable: true })
  historyId: number | null;

  @ManyToOne(() => SystemCommissionHistory, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'historyId', foreignKeyConstraintName: 'FK_system_commission_change_history_historyId' })
  history: SystemCommissionHistory | null;

  @Column({ type: 'double precision' })
  currentTotalCommission: number;

  @Column({ type: 'double precision' })
  currentDueCommission: number;

  @Column({ type: 'double precision' })
  currentPaidCommission: number;

  @Index('IDX_system_commission_change_history_status')
  @Column({ type: 'varchar', length: 40 })
  commissionStatus: CommissionStatus;

  @Column({ type: 'double precision' })
  newTotalCommission: number;

  @Column({ type: 'double precision' })
  newDueCommission: number;

  @Column({ type: 'double precision' })
  newPaidCommission: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
