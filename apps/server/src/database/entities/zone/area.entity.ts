import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Country } from './country.entity';
import { Division } from './division.entity';
import { District } from './district.entity';

@Entity()
@Unique(['districtId', 'slug'])
export class Area extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column()
  slug: string;

  @Column({ default: true })
  isActive: boolean;

  @Index()
  @Column()
  countryId: number;

  @ManyToOne(() => Country, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'countryId' })
  country: Country;

  @Index()
  @Column()
  divisionId: number;

  @ManyToOne(() => Division, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'divisionId' })
  division: Division;

  @Index()
  @Column()
  districtId: number;

  @ManyToOne(() => District, (district) => district.areas, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'districtId' })
  district: District;
}
