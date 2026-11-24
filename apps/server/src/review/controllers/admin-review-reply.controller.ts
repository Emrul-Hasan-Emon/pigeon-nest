import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ActorResolverService } from '../../shared/services/actor-resolver.service';
import { ModerateDto, RestoreDto, UpdateReplyDto } from '../dtos/review.dtos';
import { ReviewAdminService } from '../services/review-admin.service';
import { ReviewReplyService } from '../services/review-reply.service';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';

@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/review-replies', version: '1' })
export class AdminReviewReplyController {
  constructor(
    private readonly reviews: ReviewAdminService,
    private readonly replies: ReviewReplyService,
    private readonly actors: ActorResolverService,
  ) {}

  // An admin can edit or delete only a reply they wrote themselves.
  @Patch(':id')
  async update(@CurrentUser() jwt: JwtPayload, @Param('id', ParseIdPipe) id: number, @Body() dto: UpdateReplyDto) {
    return this.replies.update(await this.actors.resolve(jwt), id, dto.body);
  }

  // Delete is switched off for now. Remove these comment marks to bring it back.
  // @Delete(':id')
  // async remove(@CurrentUser() jwt: JwtPayload, @Param('id', ParseIdPipe) id: number) {
  //   return this.replies.remove(await this.actors.resolve(jwt), id);
  // }

  @Post(':id/hide')
  async hide(@CurrentUser() jwt: JwtPayload, @Param('id', ParseIdPipe) id: number, @Body() dto: ModerateDto) {
    return this.reviews.hideReply(await this.actors.resolve(jwt), id, dto.reason);
  }

  @Post(':id/restore')
  async restore(@CurrentUser() jwt: JwtPayload, @Param('id', ParseIdPipe) id: number, @Body() dto: RestoreDto) {
    return this.reviews.restoreReply(await this.actors.resolve(jwt), id, dto.reason);
  }
}
