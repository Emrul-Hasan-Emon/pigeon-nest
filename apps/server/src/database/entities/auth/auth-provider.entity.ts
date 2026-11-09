import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { User } from '../person/user.entity';

@Entity()
export class AuthProvider extends BaseEntity {
  @Index()
  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column()
  provider: string;

  @Column()
  providerKey: string;

  @Column({ nullable: true })
  email: string;
}
