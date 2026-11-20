import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Address } from './address.entity';
import { UserStatus } from '../../enums/user-status.enum';
import { UserStatusChangeHistory } from './user-status-change-history.entity';

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

  // New users are active. Only an admin can suspend (with a reason).
  @Column({ type: 'varchar', default: UserStatus.ACTIVE })
  status: UserStatus;

  // Why the user is suspended; cleared when they are reactivated.
  @Column({ type: 'text', nullable: true })
  suspensionReason: string | null;

  @OneToMany(() => Address, (address) => address.user)
  addresses: Address[];

  @OneToMany(() => UserStatusChangeHistory, (entry) => entry.user)
  statusHistory: UserStatusChangeHistory[];
}
