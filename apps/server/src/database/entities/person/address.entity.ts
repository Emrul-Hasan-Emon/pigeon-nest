import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { User } from './user.entity';
import { Division } from '../zone/division.entity';
import { District } from '../zone/district.entity';
import { AddressType } from '../../enums/address-type.enum';

@Entity()
export class Address extends BaseEntity {
  @Index()
  @Column()
  userId: number;

  @ManyToOne(() => User, (user) => user.addresses, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column({ type: 'varchar', default: AddressType.SHIPPING })
  type: AddressType;

  @Column({ type: 'varchar', length: 255 })
  recipientName: string;

  @Column()
  phone: string;

  @Column({ type: 'text' })
  address: string;

  @Index()
  @Column({ type: 'int', nullable: true })
  divisionId: number | null;

  @ManyToOne(() => Division, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'divisionId' })
  division: Division;

  @Index()
  @Column({ type: 'int', nullable: true })
  districtId: number | null;

  @ManyToOne(() => District, { onDelete: 'SET NULL' })
  @JoinColumn()
  district: District;

  @Column({ nullable: true })
  zipCode: string;

  @Column({ default: false })
  isDefault: boolean;
}
