import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUserAccount } from '../../auth/decorators/current-user-account.decorator';
import { UserAccessGuard } from '../../auth/guards/user-access.guard';
import { User } from '../../database/entities/person/user.entity';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ReportDto, UpdateReplyDto } from '../dtos/review.dtos';
import { customerActor } from '../services/review-core.service';
import { ReviewEngagementService } from '../services/review-engagement.service';
import { ReviewReplyService } from '../services/review-reply.service';
import { UserAuthGuard } from '../../auth/guards/user-auth.guard';

@UseGuards(UserAuthGuard, UserAccessGuard)
@Controller({ path: 'api/user/review-replies', version: '1' })
export class UserReviewReplyController {
  constructor(
    private readonly replies: ReviewReplyService,
    private readonly engagement: ReviewEngagementService,
  ) {}

  @Patch(':id')
  update(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number, @Body() dto: UpdateReplyDto) {
    return this.replies.update(customerActor(user), id, dto.body);
  }

  @Delete(':id')
  remove(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number) {
    return this.replies.remove(customerActor(user), id);
  }

  @Post(':id/report')
  report(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number, @Body() dto: ReportDto) {
    return this.engagement.reportReply(customerActor(user), id, dto);
  }
}

// ---------------------------------------------------------------- seller
