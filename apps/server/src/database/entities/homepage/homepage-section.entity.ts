import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { HomepageSectionType } from '../../enums/homepage-section-type.enum';

@Entity()
export class HomepageSection extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  key: string;

  @Column({ type: 'varchar', length: 255 })
  type: HomepageSectionType;

  @Column({ type: 'jsonb' })
  content: Record<string, unknown>;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;
}
