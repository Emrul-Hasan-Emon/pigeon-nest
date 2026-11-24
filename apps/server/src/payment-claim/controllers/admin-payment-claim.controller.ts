import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ActorResolverService } from '../../shared/services/actor-resolver.service';
import { resolvePage } from '../../shared/utils/page-paginate.util';
import { ConfirmPaymentClaimDto, ListPaymentClaimsQueryDto, RejectPaymentClaimDto } from '../dtos/payment-claim.dtos';
import { StaffPaymentClaimService } from '../services/staff-payment-claim.service';

// The admin sees every "I have paid" message and can decide any of them.
@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/payment-claims', version: '1' })
export class AdminPaymentClaimController {
  constructor(
    private readonly claims: StaffPaymentClaimService,
    private readonly actors: ActorResolverService,
  ) {}

  @Get()
  list(@Query() query: ListPaymentClaimsQueryDto) {
    return this.claims.list(query, resolvePage(query), {});
  }

  @Get('summary')
  async summary() {
    return { pending: await this.claims.pendingCount({}) };
  }

  @Post(':id/confirm')
  async confirm(@CurrentUser() jwt: JwtPayload, @Param('id', ParseIdPipe) id: number, @Body() dto: ConfirmPaymentClaimDto) {
    return this.claims.confirm(id, dto, await this.actors.resolve(jwt), {});
  }

  @Post(':id/reject')
  async reject(@CurrentUser() jwt: JwtPayload, @Param('id', ParseIdPipe) id: number, @Body() dto: RejectPaymentClaimDto) {
    return this.claims.reject(id, dto.reason, await this.actors.resolve(jwt), {});
  }
}
