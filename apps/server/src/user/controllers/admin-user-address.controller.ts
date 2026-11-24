import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ActorResolverService } from '../../shared/services/actor-resolver.service';
import { CreateAddressDto, UpdateAddressDto } from '../dtos/address.dtos';
import { AddressService } from '../services/address.service';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';

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
