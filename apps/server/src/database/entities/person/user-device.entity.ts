import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { User } from './user.entity';

// A phone that has the buyer app signed in, so the server can send it a push notification.
@Entity()
@Check('CHK_user_device_platform', `"platform" IN ('android','ios')`)
export class UserDevice extends BaseEntity {
  @Index('IDX_user_device_user')
  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId', foreignKeyConstraintName: 'FK_user_device_user' })
  user: User;

  // The Firebase Cloud Messaging token of the phone. One phone is one row, whoever is signed in on it.
  @Index('UQ_user_device_token', { unique: true })
  @Column({ type: 'varchar', length: 512 })
  token: string;

  @Column({ type: 'varchar', length: 10 })
  platform: 'android' | 'ios';

  @Column({ type: 'timestamp', default: () => 'now()' })
  lastSeenAt: Date;
}
