import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { OrderReturn } from './order-return.entity';

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

  @Column()
  status: string;

  @Column({ type: 'text', nullable: true })
  note: string;
}
