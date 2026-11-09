import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Address } from './address.entity';

@Entity()
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column({ unique: true, nullable: true })
  phone: string;

  @Column()
  passwordHash: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ nullable: true })
  avatarPath: string;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ default: false })
  phoneVerified: boolean;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Address, (address) => address.user)
  addresses: Address[];
}
