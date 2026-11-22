import { Body, Controller, Get, Param, Post, Query, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { CurrentUserAccount } from '../../auth/decorators/current-user-account.decorator';
import { RequireUserAccess } from '../../auth/decorators/require-user-access.decorator';
import { UserAccessGuard } from '../../auth/guards/user-access.guard';
import { User } from '../../database/entities/person/user.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { Actor } from '../../shared/types/actor.type';
import { CreateReturnDto, ListReturnsQueryDto, ReturnNoteDto } from '../dtos/returns.dtos';
import { UserReturnService } from '../services/user-return.service';
import { ATTACHMENTS } from './return-attachments';
import { UserAuthGuard } from '../../auth/guards/user-auth.guard';

// A customer's own returns. Suspended customers can still read them, not open new ones.
@UseGuards(UserAuthGuard, UserAccessGuard)
@Controller({ path: 'api/user/returns', version: '1' })
export class UserReturnController {
  constructor(private readonly returns: UserReturnService) {}

  private actor(user: User): Actor {
    return { id: user.id, type: AuthUserType.USER, name: user.name };
  }

  @Get()
  @RequireUserAccess('any')
  list(@CurrentUserAccount() user: User, @Query() query: ListReturnsQueryDto) {
    return this.returns.list(user.id, query);
  }

  // What can be returned on an order, and what each choice would refund.
  @Get('eligibility/:orderId')
  @RequireUserAccess('any')
  eligibility(@CurrentUserAccount() user: User, @Param('orderId', ParseIdPipe) orderId: number) {
    return this.returns.eligibility(user.id, orderId);
  }

  @Get(':id')
  @RequireUserAccess('any')
  get(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number) {
    return this.returns.get(user.id, id);
  }

  // multipart: orderId, scope, orderItemIds? (1,2,3), reason, files? (evidence)
  @Post()
  @UseInterceptors(ATTACHMENTS)
  create(
    @CurrentUserAccount() user: User,
    @Body() dto: CreateReturnDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.returns.create(this.actor(user), dto, files);
  }

  @Post(':id/cancel')
  cancel(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number, @Body() dto: ReturnNoteDto) {
    return this.returns.cancel(this.actor(user), id, dto.note);
  }
}
