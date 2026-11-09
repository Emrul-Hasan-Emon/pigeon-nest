import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { decimalTransformer } from '../../utils/decimal.transformer';

@Entity()
export class ShippingZone extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ unique: true })
  code: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  charge: number;

  @Column()
  estimatedDays: number;

  @Column({ default: true })
  supportsLiveAnimal: boolean;

  @Column({ default: true })
  isActive: boolean;
}
