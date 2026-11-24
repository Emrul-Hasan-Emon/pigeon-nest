import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { HomepagePage } from '../../../database/enums/homepage-page.enum';
import { CommonHomepageService, Device } from './common-homepage.service';

/** What the storefront shows on the homepage right now. Public. */
@Injectable()
export class StorefrontHomepageService {
  constructor(
    private readonly db: DatabaseService,
    private readonly common: CommonHomepageService,
  ) {}

  /** The live sections for a page and a device. */
  async storefront(page: HomepagePage, device: Device) {
    const qb = this.db.homepageSection
      .createQueryBuilder('s')
      .where('s.page = :page', { page })
      .orderBy(page === HomepagePage.SLOTS ? 's.slotNo' : 's.sortOrder', 'ASC')
      .addOrderBy('s.id', 'ASC');
    const sections = (await qb.getMany()).filter((s) =>
      this.common.isVisible(s, device),
    );
    const resolved = await Promise.all(
      sections.map((s) => this.common.resolve(s, device)),
    );
    return { page, device, sections: resolved.filter((s) => s.items.length > 0) };
  }
}
