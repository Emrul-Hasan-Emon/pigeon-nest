import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Seller } from './seller.entity';
import { SellerStatus } from '../../enums/seller-status.enum';
import { SellerActiveStatus } from '../../enums/seller-active-status.enum';
import { SellerStatusChangeAction } from '../../enums/seller-status-change-action.enum';

// Append-only audit log: one row every time a seller's status and/or
// activeStatus is set (including the initial state). Both pairs are stored on
// every row so a row shows the complete before and after. Who did it is in the
// BaseEntity tracker fields: createdBy / creatorType / creatorName.
@Entity()
export class SellerStatusChangeHistory extends BaseEntity {
  @Index()
  @Column()
  sellerId: number;

  @ManyToOne(() => Seller, (seller) => seller.statusHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sellerId' })
  seller: Seller;

  // null on the first entry (the state the seller was created with).
  @Column({ type: 'varchar', nullable: true })
  fromStatus: SellerStatus | null;

  @Column({ type: 'varchar' })
  toStatus: SellerStatus;

  @Column({ type: 'varchar', nullable: true })
  fromActiveStatus: SellerActiveStatus | null;

  @Column({ type: 'varchar' })
  toActiveStatus: SellerActiveStatus;

  @Column({ type: 'varchar' })
  action: SellerStatusChangeAction;

  // Required when an admin rejects or suspends a seller; optional otherwise.
  @Column({ type: 'text', nullable: true })
  reason: string | null;
}
