import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { OrderReturn } from './order-return.entity';
import { OrderReturnAttachment } from './order-return-attachment.entity';
import { ReturnStatus } from '../../enums/return-status.enum';

// Every move of a return, with who made it (creator columns), the note and any proof.
@Entity()
export class OrderReturnStatusHistory extends BaseEntity {
  @Index()
  @Column()
  orderReturnId: number;

  @ManyToOne(() => OrderReturn, (orderReturn) => orderReturn.statusHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  orderReturn: OrderReturn;

  // Empty for the first entry.
  @Column({ type: 'varchar', length: 30, nullable: true })
  fromStatus: ReturnStatus | null;

  @Column({ type: 'varchar', length: 30 })
  status: ReturnStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @OneToMany(() => OrderReturnAttachment, (a) => a.statusHistory)
  attachments: OrderReturnAttachment[];
}
