import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { User } from './user.entity';
import { AddressType } from '../../enums/address-type.enum';

// A customer's saved delivery address. Orders copy the address they were placed
// with, so editing or deleting one never changes an order.
@Entity()
@Index('UQ_address_default_per_user', ['userId'], {
  unique: true,
  where: '"isDefault" = true AND "deletedAt" IS NULL',
})
export class Address extends BaseEntity {
  @Index('IDX_address_userId')
  @Column()
  userId: number;

  @ManyToOne(() => User, (user) => user.addresses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId', foreignKeyConstraintName: 'FK_address_userId' })
  user: User;

  @Column({ type: 'varchar', default: AddressType.SHIPPING })
  type: AddressType;

  @Column({ type: 'varchar', length: 255 })
  recipientName: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  // ISO 3166-1 alpha-2, e.g. US
  @Column({ type: 'varchar', length: 2 })
  countryCode: string;

  // State, province or division.
  @Column({ type: 'varchar', length: 120, nullable: true })
  state: string | null;

  // City or district.
  @Column({ type: 'varchar', length: 120 })
  city: string;

  // The full address in words: house, road, area, landmarks.
  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  zipCode: string | null;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;
}
