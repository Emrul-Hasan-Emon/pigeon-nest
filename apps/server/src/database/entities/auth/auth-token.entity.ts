import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { AuthUserType } from '../../enums/auth-user-type.enum';

@Entity()
export class AuthToken extends BaseEntity {
  @Index()
  @Column()
  userId: number;

  @Index()
  @Column({ type: 'varchar' })
  userType: AuthUserType;

  @Column({ unique: true })
  token: string;

  @Column({ nullable: true })
  userAgent: string;

  @Column({ nullable: true })
  origin: string;

  @Index()
  @Column({ default: false })
  revoked: boolean;
}
