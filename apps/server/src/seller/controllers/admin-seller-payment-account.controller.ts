import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ActorResolverService } from '../../shared/services/actor-resolver.service';
import { CreatePaymentAccountDto, UpdatePaymentAccountDto } from '../dtos/payment-account.dto';
import { CommonPaymentAccountService } from '../services/common-payment-account.service';

// The admin sees and can fix any seller's payment accounts (for example when helping a new seller).
@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/sellers/:sellerId/payment-accounts', version: '1' })
export class AdminSellerPaymentAccountController {
  constructor(
    private readonly accounts: CommonPaymentAccountService,
    private readonly actors: ActorResolverService,
  ) {}

  @Get()
  list(@Param('sellerId', ParseIdPipe) sellerId: number) {
    return this.accounts.list(sellerId);
  }

  @Post()
  async create(@CurrentUser() jwt: JwtPayload, @Param('sellerId', ParseIdPipe) sellerId: number, @Body() dto: CreatePaymentAccountDto) {
    return this.accounts.create(sellerId, dto, await this.actors.resolve(jwt));
  }

  @Patch(':id')
  async update(@CurrentUser() jwt: JwtPayload, @Param('sellerId', ParseIdPipe) sellerId: number, @Param('id', ParseIdPipe) id: number, @Body() dto: UpdatePaymentAccountDto) {
    return this.accounts.update(sellerId, id, dto, await this.actors.resolve(jwt));
  }
}
