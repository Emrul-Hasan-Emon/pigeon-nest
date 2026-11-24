import { Controller, Get, Query } from '@nestjs/common';
import { HomepagePage } from '../../../database/enums/homepage-page.enum';
import { StorefrontHomepageQueryDto } from '../dtos/homepage-section.dtos';
import { StorefrontHomepageService } from '../services/storefront-homepage.service';

// Public: no auth. Returns only what is live right now for the device.
@Controller({ path: 'api/user/homepage', version: '1' })
export class StorefrontHomepageController {
  constructor(private readonly homepage: StorefrontHomepageService) {}

  @Get()
  get(@Query() query: StorefrontHomepageQueryDto) {
    return this.homepage.storefront(
      (query.page as HomepagePage) ?? HomepagePage.MAIN,
      query.device ?? 'web',
    );
  }
}
