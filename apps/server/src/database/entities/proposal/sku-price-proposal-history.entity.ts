import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { SkuPriceProposal } from './sku-price-proposal.entity';
import { AuthUserType } from '../../enums/auth-user-type.enum';
import { SkuPriceProposalAction } from '../../enums/sku-price-proposal.enums';

// Append-only log of a proposal: every offer, counter, answer and use, with the
// figures at that moment. Buyer, seller and admin all read the price history here.
@Entity()
export class SkuPriceProposalHistory extends BaseEntity {
  @Index()
  @Column()
  proposalId: number;

  @ManyToOne(() => SkuPriceProposal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'proposalId' })
  proposal: SkuPriceProposal;

  @Column({ type: 'varchar', length: 20 })
  action: SkuPriceProposalAction;

  @Column({ type: 'varchar', length: 20 })
  actorType: AuthUserType;

  @Column({ type: 'int', nullable: true })
  actorId: number | null;

  @Column({ type: 'varchar', nullable: true })
  actorName: string | null;

  @Column({ type: 'double precision' })
  price: number;

  @Column()
  quantity: number;

  // The SKU's price at the time of this step.
  @Column({ type: 'double precision' })
  skuPriceAtTime: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;
}
