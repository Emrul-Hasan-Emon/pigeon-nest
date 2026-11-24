import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUserAccount } from '../../auth/decorators/current-user-account.decorator';
import { RequireUserAccess } from '../../auth/decorators/require-user-access.decorator';
import { UserAccessGuard } from '../../auth/guards/user-access.guard';
import { UserAuthGuard } from '../../auth/guards/user-auth.guard';
import { User } from '../../database/entities/person/user.entity';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { PageQueryDto, resolvePage } from '../../shared/utils/page-paginate.util';
import { AskQuestionDto } from '../dtos/question.dtos';
import { UserQuestionService } from '../services/user-question.service';

@Controller({ path: 'api/user/questions', version: '1' })
export class UserQuestionController {
  constructor(private readonly questions: UserQuestionService) {}

  // A customer's own questions.
  @UseGuards(UserAuthGuard, UserAccessGuard)
  @RequireUserAccess('any')
  @Get()
  mine(@CurrentUserAccount() user: User, @Query() query: PageQueryDto) {
    return this.questions.mine(user, resolvePage(query));
  }

  // Anyone may read the questions on a product.
  @Get('product/:productId')
  list(@Param('productId', ParseIdPipe) productId: number, @Query() query: PageQueryDto) {
    return this.questions.listForProduct(productId, resolvePage(query));
  }

  // Asking needs a signed-in, active customer.
  @UseGuards(UserAuthGuard, UserAccessGuard)
  @Post('product/:productId')
  ask(@CurrentUserAccount() user: User, @Param('productId', ParseIdPipe) productId: number, @Body() dto: AskQuestionDto) {
    return this.questions.ask(user, productId, dto);
  }
}
