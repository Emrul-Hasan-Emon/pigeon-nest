import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { CurrentSeller } from '../../auth/decorators/current-seller.decorator';
import { RequireSellerAccess } from '../../auth/decorators/require-seller-access.decorator';
import { SellerAccessGuard } from '../../auth/guards/seller-access.guard';
import { SellerAuthGuard } from '../../auth/guards/seller-auth.guard';
import { Seller } from '../../database/entities/seller/seller.entity';
import { CursorPagination, CursorPaginationParams } from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { resolvePage } from '../../shared/utils/page-paginate.util';
import { CreateAddressDto } from '../../user/dtos/address.dtos';
import {
  BulkChangeOrderStatusDto,
  ChangeOrderStatusDto,
  ChangeRefundStatusDto,
  CreateStaffOrderDto,
  CustomerSearchQueryDto,
  ListPaymentQueryDto,
  ListRefundsQueryDto,
  ListStaffOrderQueryDto,
  PostOrderUpdateDto,
  RecordPaymentDto,
  ReversePaymentDto,
  StaffCatalogQueryDto,
  StaffOrderOptionsQueryDto,
} from '../dtos/order-staff.dtos';
import { SellerOrderService } from '../services/seller-order.service';
import { ATTACHMENTS } from '../utils/order-attachments';

// Everything a seller does with their own orders, payments and refunds. Another seller's order is "not found".
// Static paths stay above ':id'.
@UseGuards(SellerAuthGuard, SellerAccessGuard)
@RequireSellerAccess('full')
@Controller({ path: 'api/seller/order', version: '1' })
export class SellerOrderController {
  constructor(private readonly orders: SellerOrderService) {}

  // ---- orders ----

  @Get()
  list(@CurrentSeller() seller: Seller, @Query() query: ListStaffOrderQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.orders.list(seller, query, pagination);
  }

  @Get('customers')
  customers(@Query() query: CustomerSearchQueryDto) {
    return this.orders.customers(query.q);
  }

  // While entering an order: the customer's saved addresses to pick from...
  @Get('customers/:userId/addresses')
  async customerAddresses(@Param('userId', ParseIdPipe) userId: number) {
    return this.orders.customerAddresses(userId);
  }

  // ...and a way to save a new one to the customer's address book.
  @Post('customers/:userId/addresses')
  async saveCustomerAddress(@CurrentSeller() seller: Seller, @Param('userId', ParseIdPipe) userId: number, @Body() dto: CreateAddressDto) {
    return this.orders.saveCustomerAddress(seller, userId, dto);
  }

  @Get('catalog')
  catalog(@CurrentSeller() seller: Seller, @Query() query: StaffCatalogQueryDto) {
    return this.orders.catalog(seller, query);
  }

  @Get('options')
  options(@Query() query: StaffOrderOptionsQueryDto) {
    return this.orders.options(query.countryCode, query.subtotal);
  }

  @Post()
  create(@CurrentSeller() seller: Seller, @Body() dto: CreateStaffOrderDto) {
    return this.orders.create(seller, dto);
  }

  // Moves several orders to one new status. They must all be in the same status now (50 at most).
  @Post('bulk-status')
  bulkStatus(@CurrentSeller() seller: Seller, @Body() dto: BulkChangeOrderStatusDto) {
    return this.orders.bulkStatus(seller, dto);
  }

  // ---- the payment list: payments on the seller's own orders ----

  @Get('payments')
  listPayments(@CurrentSeller() seller: Seller, @Query() query: ListPaymentQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.orders.listPayments(seller, query, pagination);
  }

  @Get('payments/:id')
  paymentDetails(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number) {
    return this.orders.paymentDetails(seller, id);
  }

  // ---- refunds: the seller's cancelled orders that had money paid, and the steps to send it back ----
  // A suspended seller can read them (access 'any'), but only a full seller can act.

  @Get('refunds')
  @RequireSellerAccess('any')
  listRefunds(@CurrentSeller() seller: Seller, @Query() query: ListRefundsQueryDto) {
    return this.orders.listRefunds(seller, query, resolvePage(query));
  }

  @Get('refunds/summary')
  @RequireSellerAccess('any')
  refundSummary(@CurrentSeller() seller: Seller) {
    return this.orders.refundSummary(seller);
  }

  @Get('refunds/:id')
  @RequireSellerAccess('any')
  refundDetail(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number) {
    return this.orders.refundDetail(seller, id);
  }

  // multipart: status, amount, note, transactionId, files. needs_to_refund -> processing -> refunded.
  // Refunded needs the amount (exactly what the buyer paid), a note and at least one proof file.
  @Post('refunds/:id/status')
  @UseInterceptors(ATTACHMENTS)
  changeRefund(
    @CurrentSeller() seller: Seller,
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: ChangeRefundStatusDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.orders.changeRefund(seller, id, dto, files);
  }

  // ---- one order ----

  @Get(':id')
  details(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number) {
    return this.orders.details(seller, id);
  }

  // pending -> confirmed or cancelled, then packed, shipped, delivered. No cancelling after confirmed.
  @Patch(':id/status')
  changeStatus(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number, @Body() dto: ChangeOrderStatusDto) {
    return this.orders.changeStatus(seller, id, dto);
  }

  @Post(':id/payments')
  @UseInterceptors(ATTACHMENTS)
  recordPayment(
    @CurrentSeller() seller: Seller,
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: RecordPaymentDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.orders.recordPayment(seller, id, dto, files);
  }

  @Post(':id/payments/:paymentId/reverse')
  reversePayment(
    @CurrentSeller() seller: Seller,
    @Param('id', ParseIdPipe) id: number,
    @Param('paymentId', ParseIdPipe) paymentId: number,
    @Body() dto: ReversePaymentDto,
  ) {
    return this.orders.reversePayment(seller, id, paymentId, dto);
  }

  @Post(':id/updates')
  @UseInterceptors(ATTACHMENTS)
  postUpdate(
    @CurrentSeller() seller: Seller,
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: PostOrderUpdateDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.orders.postUpdate(seller, id, dto, files);
  }
}
