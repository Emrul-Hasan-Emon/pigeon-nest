import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentSeller } from '../../auth/decorators/current-seller.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequireSellerAccess } from '../../auth/decorators/require-seller-access.decorator';
import { SellerAccessGuard } from '../../auth/guards/seller-access.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { Seller } from '../../database/entities/seller/seller.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import {
  CursorPagination,
  CursorPaginationParams,
} from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ActorResolverService } from '../../shared/services/actor-resolver.service';
import {
  ChangeOrderStatusDto,
  CreateStaffOrderDto,
  CustomerSearchQueryDto,
  ListStaffOrderQueryDto,
  StaffCatalogQueryDto,
  StaffOrderOptionsQueryDto,
} from '../dtos/order-staff.dtos';
import { StaffOrderService } from '../services/staff-order.service';
import { CreateAddressDto } from '../../user/dtos/address.dtos';
import { AddressService } from '../../user/services/address.service';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';
import { SellerAuthGuard } from '../../auth/guards/seller-auth.guard';

const { ADMIN, SELLER } = AuthUserType;

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

// A seller's own orders. Another seller's order is "not found".
@UseGuards(SellerAuthGuard, SellerAccessGuard)
@RequireSellerAccess('full')
@Controller({ path: 'api/seller/orders', version: '1' })
export class SellerOrderController {
  constructor(
    private readonly orders: StaffOrderService,
    private readonly addresses: AddressService,
  ) {}

  private actor(seller: Seller) {
    return { id: seller.id, type: SELLER, name: seller.name };
  }

  @Get()
  list(
    @CurrentSeller() seller: Seller,
    @Query() query: ListStaffOrderQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.orders.list({ ...query, sellerId: undefined, sellerSearch: undefined }, pagination, SELLER, {
      sellerId: seller.id,
    });
  }

  @Get('customers')
  customers(@Query() query: CustomerSearchQueryDto) {
    return this.orders.findCustomers(query.q);
  }

  // While entering an order: the customer's saved addresses to pick from...
  @Get('customers/:userId/addresses')
  async customerAddresses(@Param('userId', ParseIdPipe) userId: number) {
    await this.addresses.ensureUser(userId);
    return this.addresses.list(userId);
  }

  // ...and a way to save a new one to the customer's address book.
  @Post('customers/:userId/addresses')
  async saveCustomerAddress(
    @CurrentSeller() seller: Seller,
    @Param('userId', ParseIdPipe) userId: number,
    @Body() dto: CreateAddressDto,
  ) {
    await this.addresses.ensureActiveUser(userId);
    return this.addresses.create(userId, dto, this.actor(seller));
  }

  @Get('catalog')
  catalog(@CurrentSeller() seller: Seller, @Query() query: StaffCatalogQueryDto) {
    return this.orders.catalog(query, { sellerId: seller.id });
  }

  @Get('options')
  options(@Query() query: StaffOrderOptionsQueryDto) {
    return this.orders.options(query.countryCode, query.subtotal);
  }

  @Post()
  create(@CurrentSeller() seller: Seller, @Body() dto: CreateStaffOrderDto) {
    return this.orders.create(dto, this.actor(seller), { sellerId: seller.id });
  }

  @Get(':id')
  details(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number) {
    return this.orders.detail(id, SELLER, { sellerId: seller.id });
  }

  // pending -> confirmed or cancelled, then packed, shipped, delivered. No cancelling after confirmed.
  @Patch(':id/status')
  changeStatus(
    @CurrentSeller() seller: Seller,
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: ChangeOrderStatusDto,
  ) {
    return this.orders.changeStatus(id, dto, this.actor(seller), SELLER, { sellerId: seller.id });
  }
}
