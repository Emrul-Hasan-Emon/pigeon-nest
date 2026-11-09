import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AuthUserType } from '../enums/auth-user-type.enum';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  createdBy: number | null;

  @Column({ type: 'varchar', nullable: true })
  creatorType: AuthUserType | null;

  @Column({ type: 'varchar', nullable: true })
  creatorName: string | null;

  @Column({ type: 'int', nullable: true })
  updatedBy: number | null;

  @Column({ type: 'varchar', nullable: true })
  updaterType: AuthUserType | null;

  @Column({ type: 'varchar', nullable: true })
  updaterName: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
