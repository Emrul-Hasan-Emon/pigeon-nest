import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { HomepageSectionType } from '../../enums/homepage-section-type.enum';
import { HomepagePage } from '../../enums/homepage-page.enum';
import { HomepageLayout } from '../../enums/homepage-layout.enum';
import { HomepageDeviceVisibility } from '../../enums/homepage-device-visibility.enum';

// One block of a homepage. `config` is validated per section type by the
// registry in src/content/homepage.
@Entity()
@Index('UQ_homepage_section_page_slot', ['page', 'slotNo'], {
  unique: true,
  where: '"slotNo" IS NOT NULL',
})
export class HomepageSection extends BaseEntity {
  @Index('IDX_homepage_section_page')
  @Column({ type: 'varchar', default: HomepagePage.MAIN })
  page: HomepagePage;

  // Only set for the fixed-slot page (1..HOMEPAGE_SLOT_COUNT).
  @Column({ type: 'int', nullable: true })
  slotNo: number | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar' })
  sectionType: HomepageSectionType;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  config: Record<string, unknown>;

  @Column({ type: 'varchar', default: HomepageLayout.CAROUSEL })
  layout: HomepageLayout;

  @Column({ type: 'varchar', default: HomepageDeviceVisibility.BOTH })
  deviceVisibility: HomepageDeviceVisibility;

  @Column({ default: 0 })
  sortOrder: number;

  // Optional schedule window; outside it the section is hidden on the storefront.
  @Column({ type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @Column({ default: true })
  isActive: boolean;
}
