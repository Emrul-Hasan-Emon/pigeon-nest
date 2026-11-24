import { Controller, Get, Param, Query } from '@nestjs/common';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { StorefrontSellerQueryDto } from '../dtos/storefront-seller-query.dto';
import { StorefrontSellerService } from '../services/storefront-seller.service';
import { resolvePage } from '../../shared/utils/page-paginate.util';

@Controller({ path: 'api/user/sellers', version: '1' })
export class StorefrontSellerController {
  constructor(private readonly sellers: StorefrontSellerService) {}

  @Get()
  list(@Query() query: StorefrontSellerQueryDto) {
    return this.sellers.list(query.search, query.sort, resolvePage(query));
  }

  @Get(':id')
  details(@Param('id', ParseIdPipe) id: number) {
    return this.sellers.details(id);
  }
}
