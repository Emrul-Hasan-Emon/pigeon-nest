import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../base.entity';

@Entity()
export class Banner extends BaseEntity {
  @Column({ type: 'varchar', length: 300 })
  title: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ nullable: true })
  imagePath: string;

  @Column({ nullable: true })
  mobileImageUrl: string;

  @Column({ nullable: true })
  mobileImagePath: string;

  @Column({ nullable: true })
  linkUrl: string;

  @Column({ nullable: true })
  position: string;

  @Column({ type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;
}
