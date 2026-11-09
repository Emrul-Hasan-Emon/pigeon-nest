import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Division } from './division.entity';

@Entity()
export class Country extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ unique: true })
  slug: string;
  
  @Column({ type: 'varchar', length: 10, nullable: true })
  code: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  currency: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Division, (division) => division.country)
  divisions: Division[];
}
