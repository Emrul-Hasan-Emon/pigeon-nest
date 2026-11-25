import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import {
  CursorPaginationParams,
  CursorPagination,
} from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ActorResolverService } from '../../shared/services/actor-resolver.service';
import { CreateAddressDto, UpdateAddressDto } from '../dtos/address.dtos';
import { ListUserStatusHistoryQueryDto } from '../dtos/list-user-status-history-query.dto';
import { CommonUserService } from '../services/common-user.service';
import { AdminUserService } from '../services/admin-user.service';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { ListUserQueryDto } from '../dtos/list-user-query.dto';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';

const AVATAR_FILE = FileInterceptor('avatar', {
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/user', version: '1' })
export class AdminUserController {
  constructor(
    private readonly adminUserService: AdminUserService,
    private readonly common: CommonUserService,
    private readonly actors: ActorResolverService,
  ) {}

  @Get()
  list(
    @Query() query: ListUserQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.adminUserService.list(query, pagination);
  }

  // Read-only log of user status changes. Users never see it.
  @Get('status-history')
  statusHistory(@Query() query: ListUserStatusHistoryQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.adminUserService.statusHistory(query, pagination);
  }

  @Get(':id')
  details(@Param('id', ParseIdPipe) id: number) {
    return this.adminUserService.details(id);
  }

  // Multipart: name, phone (+countrycode), password, optional email and avatar.
  @Post()
  @UseInterceptors(AVATAR_FILE)
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() admin: JwtPayload,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    return this.adminUserService.create(dto, admin, avatar);
  }

  // Multipart. status + statusReason suspend/reactivate (and are logged).
  @Patch(':id')
  @UseInterceptors(AVATAR_FILE)
  update(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() admin: JwtPayload,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    return this.adminUserService.update(id, dto, admin, avatar);
  }

  // ---- the customer's address book, managed by an admin on their behalf

  @Get(':userId/addresses')
  async listAddresses(@Param('userId', ParseIdPipe) userId: number) {
    await this.common.ensureUser(userId);
    return this.common.listAddresses(userId);
  }

  @Post(':userId/addresses')
  async createAddress(@CurrentUser() admin: JwtPayload, @Param('userId', ParseIdPipe) userId: number, @Body() dto: CreateAddressDto) {
    await this.common.ensureUser(userId);
    return this.common.createAddress(userId, dto, await this.actors.resolve(admin));
  }

  @Get(':userId/addresses/:id')
  async getAddress(@Param('userId', ParseIdPipe) userId: number, @Param('id', ParseIdPipe) id: number) {
    await this.common.ensureUser(userId);
    return this.common.getAddress(userId, id);
  }

  @Patch(':userId/addresses/:id')
  async updateAddress(
    @CurrentUser() admin: JwtPayload,
    @Param('userId', ParseIdPipe) userId: number,
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: UpdateAddressDto,
  ) {
    await this.common.ensureUser(userId);
    return this.common.updateAddress(userId, id, dto, await this.actors.resolve(admin));
  }

  // Delete is switched off for now. Remove these comment marks to bring it back.
  // @Delete(':userId/addresses/:id')
  // @HttpCode(HttpStatus.NO_CONTENT)
  // async removeAddress(
  //   @CurrentUser() admin: JwtPayload,
  //   @Param('userId', ParseIdPipe) userId: number,
  //   @Param('id', ParseIdPipe) id: number,
  // ) {
  //   await this.common.ensureUser(userId);
  //   return this.common.removeAddress(userId, id, await this.actors.resolve(admin));
  // }
}
