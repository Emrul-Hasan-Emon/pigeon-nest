import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { CursorPagination, CursorPaginationParams } from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ActorResolverService } from '../../shared/services/actor-resolver.service';
import {
  BulkChangeOrderStatusDto,
  ChangeOrderStatusDto,
  CreateStaffOrderDto,
  CustomerSearchQueryDto,
  ListStaffOrderQueryDto,
  StaffCatalogQueryDto,
  StaffOrderOptionsQueryDto,
} from '../dtos/order-staff.dtos';
import { StaffOrderService } from '../services/staff-order.service';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';

const { ADMIN } = AuthUserType;

// All orders, for the admin. Static paths stay above ':id'.
@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/orders', version: '1' })
export class AdminOrderController {
  constructor(
    private readonly orders: StaffOrderService,
    private readonly actors: ActorResolverService,
  ) {}

  @Get()
  list(@Query() query: ListStaffOrderQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.orders.list(query, pagination, ADMIN);
  }

  // Step 1 of entering an order: find the customer by email or mobile.
  @Get('customers')
  customers(@Query() query: CustomerSearchQueryDto) {
    return this.orders.findCustomers(query.q);
  }

  // Step 2: the chosen seller's products and variants.
  @Get('catalog')
  catalog(@Query() query: StaffCatalogQueryDto) {
    return this.orders.catalog(query, {});
  }

  @Get('options')
  options(@Query() query: StaffOrderOptionsQueryDto) {
    return this.orders.options(query.countryCode, query.subtotal);
  }

  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateStaffOrderDto) {
    return this.orders.create(dto, await this.actors.resolve(user), {});
  }

  // Moves several orders to one new status. They must all be in the same status now (50 at most).
  @Post('bulk-status')
  async bulkStatus(@CurrentUser() user: JwtPayload, @Body() dto: BulkChangeOrderStatusDto) {
    return this.orders.bulkChangeStatus(dto, await this.actors.resolve(user), {});
  }

  @Get(':id')
  details(@Param('id', ParseIdPipe) id: number) {
    return this.orders.detail(id, ADMIN);
  }

  // The admin can move an order to any other status.
  @Patch(':id/status')
  async changeStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: ChangeOrderStatusDto,
  ) {
    return this.orders.changeStatus(id, dto, await this.actors.resolve(user), ADMIN);
  }
}
