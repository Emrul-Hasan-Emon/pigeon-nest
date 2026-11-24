import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentUserAccount } from '../../auth/decorators/current-user-account.decorator';
import { UserAccessGuard } from '../../auth/guards/user-access.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { User } from '../../database/entities/person/user.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ActorResolverService } from '../../shared/services/actor-resolver.service';
import { CreateAddressDto, UpdateAddressDto } from '../dtos/address.dtos';
import { AddressService } from '../services/address.service';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';
import { UserAuthGuard } from '../../auth/guards/user-auth.guard';

// A customer's own address book.
@UseGuards(UserAuthGuard, UserAccessGuard)
@Controller({ path: 'api/user/addresses', version: '1' })
export class UserAddressController {
  constructor(private readonly addresses: AddressService) {}

  private actor(user: User) {
    return { id: user.id, type: AuthUserType.USER, name: user.name };
  }

  @Get()
  list(@CurrentUserAccount() user: User) {
    return this.addresses.list(user.id);
  }

  @Post()
  create(@CurrentUserAccount() user: User, @Body() dto: CreateAddressDto) {
    return this.addresses.create(user.id, dto, this.actor(user));
  }

  @Get(':id')
  get(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number) {
    return this.addresses.get(user.id, id);
  }

  @Patch(':id')
  update(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number, @Body() dto: UpdateAddressDto) {
    return this.addresses.update(user.id, id, dto, this.actor(user));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number) {
    return this.addresses.remove(user.id, id, this.actor(user));
  }
}

// The same address book, managed by an admin for a customer.
@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/users/:userId/addresses', version: '1' })
export class AdminUserAddressController {
  constructor(
    private readonly addresses: AddressService,
    private readonly actors: ActorResolverService,
  ) {}

  @Get()
  async list(@Param('userId', ParseIdPipe) userId: number) {
    await this.addresses.ensureUser(userId);
    return this.addresses.list(userId);
  }

  @Post()
  async create(
    @CurrentUser() admin: JwtPayload,
    @Param('userId', ParseIdPipe) userId: number,
    @Body() dto: CreateAddressDto,
  ) {
    await this.addresses.ensureUser(userId);
    return this.addresses.create(userId, dto, await this.actors.resolve(admin));
  }

  @Get(':id')
  async get(@Param('userId', ParseIdPipe) userId: number, @Param('id', ParseIdPipe) id: number) {
    await this.addresses.ensureUser(userId);
    return this.addresses.get(userId, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() admin: JwtPayload,
    @Param('userId', ParseIdPipe) userId: number,
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: UpdateAddressDto,
  ) {
    await this.addresses.ensureUser(userId);
    return this.addresses.update(userId, id, dto, await this.actors.resolve(admin));
  }

  // Delete is switched off for now. Remove these comment marks to bring it back.
  // @Delete(':id')
  // @HttpCode(HttpStatus.NO_CONTENT)
  // async remove(
  //   @CurrentUser() admin: JwtPayload,
  //   @Param('userId', ParseIdPipe) userId: number,
  //   @Param('id', ParseIdPipe) id: number,
  // ) {
  //   await this.addresses.ensureUser(userId);
  //   return this.addresses.remove(userId, id, await this.actors.resolve(admin));
  // }
}
