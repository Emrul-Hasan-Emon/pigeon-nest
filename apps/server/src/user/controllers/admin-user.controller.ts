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
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import {
  CursorPaginationParams,
  CursorPagination,
} from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { AdminUserService } from '../services/admin-user.service';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { ListUserQueryDto } from '../dtos/list-user-query.dto';

const AVATAR_FILE = FileInterceptor('avatar', {
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

@UseGuards(AuthGuard, RolesGuard)
@Roles(AuthUserType.ADMIN)
@Controller({ path: 'api/admin/users', version: '1' })
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) {}

  @Get()
  list(
    @Query() query: ListUserQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.adminUserService.list(query, pagination);
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
}
