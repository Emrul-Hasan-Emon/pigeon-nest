import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentSeller } from '../../auth/decorators/current-seller.decorator';
import { RequireSellerAccess } from '../../auth/decorators/require-seller-access.decorator';
import { SellerAccessGuard } from '../../auth/guards/seller-access.guard';
import { Seller } from '../../database/entities/seller/seller.entity';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ReportDto, UpdateReplyDto } from '../dtos/review.dtos';
import { sellerActor } from '../services/review-core.service';
import { ReviewEngagementService } from '../services/review-engagement.service';
import { ReviewReplyService } from '../services/review-reply.service';
import { SellerAuthGuard } from '../../auth/guards/seller-auth.guard';

@UseGuards(SellerAuthGuard, SellerAccessGuard)
@RequireSellerAccess('full')
@Controller({ path: 'api/seller/review-replies', version: '1' })
export class SellerReviewReplyController {
  constructor(
    private readonly replies: ReviewReplyService,
    private readonly engagement: ReviewEngagementService,
  ) {}

  @Patch(':id')
  update(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number, @Body() dto: UpdateReplyDto) {
    return this.replies.update(sellerActor(seller), id, dto.body);
  }

  // Delete is switched off for now. Remove these comment marks to bring it back.
  // @Delete(':id')
  // remove(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number) {
  //   return this.replies.remove(sellerActor(seller), id);
  // }

  @Post(':id/report')
  report(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number, @Body() dto: ReportDto) {
    return this.engagement.reportReply(sellerActor(seller), id, dto);
  }
}

// ---------------------------------------------------------------- admin
