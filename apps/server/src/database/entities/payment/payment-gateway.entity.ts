import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { PaymentGatewayType } from '../../enums/payment-gateway-type.enum';

@Entity()
export class PaymentGateway extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ unique: true })
  slug: string;
  
  @Column({ type: 'varchar', length: 255, default: PaymentGatewayType.MFS })
  type: PaymentGatewayType;

  // Every gateway is manual for now: the customer pays outside the site and
  // the order carries the proof they enter.
  @Column({ default: true })
  isManual: boolean;

  @Column({ nullable: true })
  provider: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ nullable: true })
  iconUrl: string;

  @Column({ nullable: true })
  iconPath: string;

  @Column({ nullable: true })
  accountName: string;

  @Column({ nullable: true })
  accountNumber: string;

  @Column({ nullable: true })
  bankName: string;

  @Column({ nullable: true })
  branchName: string;

  @Column({ default: true })
  isActive: boolean;
}
