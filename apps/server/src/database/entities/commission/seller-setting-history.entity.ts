import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Seller } from '../seller/seller.entity';
import { SellerSetting } from './seller-setting.entity';
import { SellerSettingType } from '../../enums/seller-setting-type.enum';

// Append-only: one row each time a seller setting is created or changed. The
// before and after values are JSON so any future setting kind fits. Who did it
// is in the tracker fields (createdBy / creatorType / creatorName).
@Entity('seller_setting_history')
export class SellerSettingHistory extends BaseEntity {
  @Index('IDX_seller_setting_history_sellerId')
  @Column()
  sellerId: number;

  @ManyToOne(() => Seller, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerId', foreignKeyConstraintName: 'FK_seller_setting_history_sellerId' })
  seller: Seller;

  @Column({ type: 'int', nullable: true })
  settingId: number | null;

  @ManyToOne(() => SellerSetting, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'settingId', foreignKeyConstraintName: 'FK_seller_setting_history_settingId' })
  setting: SellerSetting | null;

  @Index('IDX_seller_setting_history_type')
  @Column({ type: 'varchar', length: 30 })
  settingType: SellerSettingType;

  // 'created' or 'updated'
  @Column({ type: 'varchar', length: 20 })
  action: 'created' | 'updated';

  // null when the setting did not exist before.
  @Column({ type: 'jsonb', nullable: true })
  fromValue: Record<string, unknown> | null;

  @Column({ type: 'jsonb' })
  toValue: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
