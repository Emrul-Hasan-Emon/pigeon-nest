import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Unique,
} from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Country } from './country.entity';
import { District } from './district.entity';

@Entity()
@Unique(['countryId', 'slug'])
export class Division extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column()
  slug: string;

  @Column({ default: true })
  isActive: boolean;

  @Index()
  @Column()
  countryId: number;

  @ManyToOne(() => Country, (country) => country.divisions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn()
  country: Country;

  @OneToMany(() => District, (district) => district.division)
  districts: District[];
}
