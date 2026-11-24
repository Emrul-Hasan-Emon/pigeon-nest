import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUserAccount } from '../../auth/decorators/current-user-account.decorator';
import { RequireUserAccess } from '../../auth/decorators/require-user-access.decorator';
import { UserAccessGuard } from '../../auth/guards/user-access.guard';
import { UserAuthGuard } from '../../auth/guards/user-auth.guard';
import { User } from '../../database/entities/person/user.entity';
import { PageQueryDto, resolvePage } from '../../shared/utils/page-paginate.util';
import { UserQuestionService } from '../services/user-question.service';

// A customer's own questions.
@UseGuards(UserAuthGuard, UserAccessGuard)
@Controller({ path: 'api/user/questions', version: '1' })
export class UserQuestionController {
  constructor(private readonly questions: UserQuestionService) {}

  @Get()
  @RequireUserAccess('any')
  mine(@CurrentUserAccount() user: User, @Query() query: PageQueryDto) {
    return this.questions.mine(user, resolvePage(query));
  }
}
