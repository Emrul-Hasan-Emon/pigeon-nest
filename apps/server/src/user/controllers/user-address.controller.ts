import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUserAccount } from '../../auth/decorators/current-user-account.decorator';
import { UserAccessGuard } from '../../auth/guards/user-access.guard';
import { User } from '../../database/entities/person/user.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { CreateAddressDto, UpdateAddressDto } from '../dtos/address.dtos';
import { AddressService } from '../services/address.service';
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
