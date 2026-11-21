import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { SystemCommissionDisburse } from './system-commission-disburse.entity';

// A receipt or slip that supports a commission payment. Optional.
@Entity('system_commission_disburse_attachments')
export class SystemCommissionDisburseAttachment extends BaseEntity {
  @Index('IDX_system_commission_disburse_attachments_disburseId')
  @Column()
  disburseId: number;

  @ManyToOne(() => SystemCommissionDisburse, (d) => d.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'disburseId',
    foreignKeyConstraintName: 'FK_system_commission_disburse_attachments_disburseId',
  })
  disburse: SystemCommissionDisburse;

  @Column({ type: 'varchar', length: 10 })
  kind: 'image' | 'file';

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'varchar', length: 1000 })
  fileUrl: string;

  @Column({ type: 'varchar', length: 1000 })
  filePath: string;

  @Column({ type: 'varchar', length: 150 })
  mimeType: string;

  @Column({ type: 'int' })
  size: number;
}
