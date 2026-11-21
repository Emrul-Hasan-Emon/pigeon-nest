import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Seller } from '../seller/seller.entity';
import { CommissionType } from '../../enums/commission-type.enum';
import { SellerSettingType } from '../../enums/seller-setting-type.enum';

// One row per seller per kind of setting. Today only `commission`; later kinds
// add their own nullable columns. A seller with no row uses the global setting.
@Entity('seller_setting')
@Index('UQ_seller_setting_seller_type', ['sellerId', 'settingType'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class SellerSetting extends BaseEntity {
  @Column()
  sellerId: number;

  @ManyToOne(() => Seller, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerId', foreignKeyConstraintName: 'FK_seller_setting_sellerId' })
  seller: Seller;

  @Column({ type: 'varchar', length: 30 })
  settingType: SellerSettingType;

  @Column({ type: 'varchar', length: 20, nullable: true })
  commissionType: CommissionType | null;

  @Column({ type: 'double precision', nullable: true })
  commissionAmount: number | null;
}
