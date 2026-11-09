import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../base.entity';

@Entity()
export class Language extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  code: string;

  @Column({ default: false })
  isDefault: boolean;

  @Column({ default: true })
  isActive: boolean;
}
