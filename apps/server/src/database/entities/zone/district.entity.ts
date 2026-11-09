import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Unique } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Country } from './country.entity';
import { Division } from './division.entity';
import { Area } from './area.entity';

@Entity()
@Unique(['divisionId', 'slug'])
export class District extends BaseEntity {
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
  @JoinColumn()
  country: Country;

  @Index()
  @Column()
  divisionId: number;

  @ManyToOne(() => Division, (division) => division.districts, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn()
  division: Division;

  @OneToMany(() => Area, (area) => area.district)
  areas: Area[];
}
