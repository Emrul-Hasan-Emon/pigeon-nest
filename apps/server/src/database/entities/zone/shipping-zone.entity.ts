import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { DeliveryType } from '../../enums/delivery-type.enum';

// A shipping zone is a set of countries that share one delivery charge for one
// delivery type. Destinations no active zone covers fall back to the global
// shipping settings (see ShippingQuoteService).
@Entity()
export class ShippingZone extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Index('IDX_shipping_zone_deliveryType')
  @Column({ type: 'varchar', length: 20, default: DeliveryType.STANDARD })
  deliveryType: DeliveryType;

  // ISO 3166-1 alpha-2 codes, upper case.
  @Column({ type: 'jsonb', default: () => "'[]'" })
  countryCodes: string[];

  @Column({
    type: 'double precision',
  })
  charge: number;

  @Column()
  estimatedDays: number;

  @Column({ default: true })
  supportsLiveAnimal: boolean;

  @Column({ default: true })
  isActive: boolean;
}
