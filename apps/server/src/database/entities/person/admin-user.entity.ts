import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { AdminRole } from '../../enums/admin-role.enum';

@Entity()
export class AdminUser extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'varchar', default: AdminRole.ADMIN })
  role: AdminRole;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ nullable: true })
  imagePath: string;

  @Column({ default: true })
  isActive: boolean;
}
