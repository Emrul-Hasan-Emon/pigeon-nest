import { Body, Controller, Get, Param, Post, Query, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { CurrentSeller } from '../../auth/decorators/current-seller.decorator';
import { RequireSellerAccess } from '../../auth/decorators/require-seller-access.decorator';
import { SellerAccessGuard } from '../../auth/guards/seller-access.guard';
import { Seller } from '../../database/entities/seller/seller.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { Actor } from '../../shared/types/actor.type';
import { AcceptReturnDto, ListReturnsQueryDto, RejectReturnDto, ReturnNoteDto, ReturningMoneyDto } from '../dtos/returns.dtos';
import { SellerReturnService } from '../services/seller-return.service';
import { ATTACHMENTS } from './return-attachments';
import { SellerAuthGuard } from '../../auth/guards/seller-auth.guard';

// Returns on the seller's own orders. Suspended sellers can still read them.
@UseGuards(SellerAuthGuard, SellerAccessGuard)
@Controller({ path: 'api/seller/returns', version: '1' })
export class SellerReturnController {
  constructor(private readonly returns: SellerReturnService) {}

  private actor(seller: Seller): Actor {
    return { id: seller.id, type: AuthUserType.SELLER, name: seller.name };
  }

  @Get()
  @RequireSellerAccess('any')
  list(@CurrentSeller() seller: Seller, @Query() query: ListReturnsQueryDto) {
    return this.returns.list(seller.id, query);
  }

  @Get(':id')
  @RequireSellerAccess('any')
  get(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number) {
    return this.returns.get(seller.id, id);
  }

  @Post(':id/accept')
  accept(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number, @Body() dto: AcceptReturnDto) {
    return this.returns.step(this.actor(seller), id, 'accept', dto);
  }

  @Post(':id/reject')
  reject(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number, @Body() dto: RejectReturnDto) {
    return this.returns.step(this.actor(seller), id, 'reject', dto);
  }

  @Post(':id/processing')
  processing(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number, @Body() dto: ReturnNoteDto) {
    return this.returns.step(this.actor(seller), id, 'processing', dto);
  }

  // multipart: note (what was refunded and how), files? (proof)
  @Post(':id/returning-money')
  @UseInterceptors(ATTACHMENTS)
  returningMoney(
    @CurrentSeller() seller: Seller,
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: ReturningMoneyDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.returns.step(this.actor(seller), id, 'returning_money', dto, files);
  }
}
