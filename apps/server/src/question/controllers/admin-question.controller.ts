import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ActorResolverService } from '../../shared/services/actor-resolver.service';
import { resolvePage } from '../../shared/utils/page-paginate.util';
import { AdminListQuestionsQueryDto, ModerateQuestionDto } from '../dtos/question.dtos';
import { AdminQuestionService } from '../services/admin-question.service';

// Moderation of buyer questions: read them all, hide one that breaks the rules, restore it.
@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/questions', version: '1' })
export class AdminQuestionController {
  constructor(
    private readonly questions: AdminQuestionService,
    private readonly actors: ActorResolverService,
  ) {}

  @Get()
  list(@Query() query: AdminListQuestionsQueryDto) {
    return this.questions.list(query, resolvePage(query));
  }

  @Post(':id/hide')
  async hide(@CurrentUser() jwt: JwtPayload, @Param('id', ParseIdPipe) id: number, @Body() dto: ModerateQuestionDto) {
    return this.questions.hide(id, dto.reason, await this.actors.resolve(jwt));
  }

  @Post(':id/restore')
  async restore(@CurrentUser() jwt: JwtPayload, @Param('id', ParseIdPipe) id: number) {
    return this.questions.restore(id, await this.actors.resolve(jwt));
  }
}
