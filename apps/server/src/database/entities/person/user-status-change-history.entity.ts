import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { User } from './user.entity';
import { UserStatus } from '../../enums/user-status.enum';

// Append-only audit log: one row for every status a user is put into
// (including the initial one). Who did it is in the BaseEntity tracker
// fields: createdBy / creatorType / creatorName.
@Entity()
export class UserStatusChangeHistory extends BaseEntity {
  @Index()
  @Column()
  userId: number;

  @ManyToOne(() => User, (user) => user.statusHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  // null for the first entry (the status the user was created with).
  @Column({ type: 'varchar', nullable: true })
  fromStatus: UserStatus | null;

  @Column({ type: 'varchar' })
  toStatus: UserStatus;

  @Column({ type: 'text', nullable: true })
  reason: string | null;
}
