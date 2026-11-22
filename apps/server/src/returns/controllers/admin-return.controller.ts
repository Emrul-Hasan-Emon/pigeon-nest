import { Body, Controller, Get, Param, Post, Query, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ActorResolverService } from '../../shared/services/actor-resolver.service';
import { AdminCreateReturnDto, AdminListReturnsQueryDto, AdminReturnStatusDto } from '../dtos/returns.dtos';
import { AdminReturnService } from '../services/admin-return.service';
import { ATTACHMENTS } from './return-attachments';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';

// Every return. An admin can open one for a customer and move any return to any status.
@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/returns', version: '1' })
export class AdminReturnController {
  constructor(
    private readonly returns: AdminReturnService,
    private readonly actors: ActorResolverService,
  ) {}

  @Get()
  list(@Query() query: AdminListReturnsQueryDto) {
    return this.returns.list(query);
  }

  @Get('eligibility/:orderId')
  eligibility(@Param('orderId', ParseIdPipe) orderId: number) {
    return this.returns.eligibility(orderId);
  }

  @Get(':id')
  get(@Param('id', ParseIdPipe) id: number) {
    return this.returns.get(id);
  }

  @Post()
  @UseInterceptors(ATTACHMENTS)
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AdminCreateReturnDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.returns.create(await this.actors.resolve(user), dto, files);
  }

  // multipart: status, note, includeDeliveryCharge?, files?
  @Post(':id/status')
  @UseInterceptors(ATTACHMENTS)
  async setStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: AdminReturnStatusDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.returns.setStatus(await this.actors.resolve(user), id, dto, files);
  }
}
