import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { RequireSellerAccess } from '../../auth/decorators/require-seller-access.decorator';
import { SellerAccessGuard } from '../../auth/guards/seller-access.guard';
import { SellerAuthGuard } from '../../auth/guards/seller-auth.guard';
import { HelpContentService } from '../services/help-content.service';

// How-to pages for the seller portal. The text lives in content/seller-help/*.json. Any signed-in seller can read
// it, whatever the account state (a suspended seller still needs to know what to do).
@UseGuards(SellerAuthGuard, SellerAccessGuard)
@RequireSellerAccess('any')
@Controller({ path: 'api/seller/help', version: '1' })
export class SellerHelpController {
  constructor(private readonly help: HelpContentService) {}

  @Get()
  list() {
    return { topics: this.help.list('seller-help') };
  }

  @Get(':slug')
  one(@Param('slug') slug: string) {
    return this.help.get('seller-help', slug);
  }
}
