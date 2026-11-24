import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { resolvePage } from '../../shared/utils/page-paginate.util';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { CursorPagination, CursorPaginationParams } from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import {
  AddRefundRecordDto,
  BulkChangeOrderStatusDto,
  ChangeRefundStatusDto,
  ChangeOrderStatusDto,
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
import { AdminOrderService } from '../services/admin-order.service';
import { ATTACHMENTS } from '../utils/order-attachments';

// Everything an admin does with orders, their payments and their refunds. Static paths stay above ':id'.
@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/order', version: '1' })
export class AdminOrderController {
  constructor(private readonly orders: AdminOrderService) {}

  // ---- orders ----

  @Get()
  list(@Query() query: ListStaffOrderQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.orders.list(query, pagination);
  }

  // Step 1 of entering an order: find the customer by email or mobile.
  @Get('customers')
  customers(@Query() query: CustomerSearchQueryDto) {
    return this.orders.customers(query.q);
  }

  // Step 2: the chosen seller's products and variants.
  @Get('catalog')
  catalog(@Query() query: StaffCatalogQueryDto) {
    return this.orders.catalog(query);
  }

  @Get('options')
  options(@Query() query: StaffOrderOptionsQueryDto) {
    return this.orders.options(query.countryCode, query.subtotal);
  }

  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateStaffOrderDto) {
    return this.orders.create(user, dto);
  }

  // Moves several orders to one new status. They must all be in the same status now (50 at most).
  @Post('bulk-status')
  async bulkStatus(@CurrentUser() user: JwtPayload, @Body() dto: BulkChangeOrderStatusDto) {
    return this.orders.bulkStatus(user, dto);
  }

  // ---- the payment list: every payment on every order ----

  @Get('payments')
  listPayments(@Query() query: ListPaymentQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.orders.listPayments(query, pagination);
  }

  @Get('payments/:id')
  paymentDetails(@Param('id', ParseIdPipe) id: number) {
    return this.orders.paymentDetails(id);
  }

  // ---- refunds: cancelled orders that had money paid, and the money sent back ----

  @Get('refunds')
  listRefunds(@Query() query: ListRefundsQueryDto) {
    return this.orders.listRefunds(query, resolvePage(query));
  }

  @Get('refunds/summary')
  refundSummary() {
    return this.orders.refundSummary();
  }

  @Get('refunds/:id')
  refundDetail(@Param('id', ParseIdPipe) id: number) {
    return this.orders.refundDetail(id);
  }

  // Any status to any other. Refunded needs the exact amount the buyer paid and a note; a proof file is optional for an admin.
  @Post('refunds/:id/status')
  @UseInterceptors(ATTACHMENTS)
  async changeRefund(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: ChangeRefundStatusDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.orders.changeRefund(user, id, dto, files);
  }

  // Another money record on a return (for example "refunded" after the buyer said the seller's refund never arrived).
  @Post('returns/:returnId/money-records')
  @UseInterceptors(ATTACHMENTS)
  async addReturnMoneyRecord(
    @CurrentUser() user: JwtPayload,
    @Param('returnId', ParseIdPipe) returnId: number,
    @Body() dto: AddRefundRecordDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.orders.addReturnMoneyRecord(user, returnId, dto, files);
  }

  // ---- one order ----

  @Get(':id')
  details(@Param('id', ParseIdPipe) id: number) {
    return this.orders.details(id);
  }

  // The admin can move an order to any other status.
  @Patch(':id/status')
  async changeStatus(@CurrentUser() user: JwtPayload, @Param('id', ParseIdPipe) id: number, @Body() dto: ChangeOrderStatusDto) {
    return this.orders.changeStatus(user, id, dto);
  }

  // Mark an order paid (fully or in part). multipart: description, files (1-10), amount?, transactionId?, paidAt?
  @Post(':id/payments')
  @UseInterceptors(ATTACHMENTS)
  async recordPayment(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: RecordPaymentDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.orders.recordPayment(user, id, dto, files);
  }

  // Undo a recorded payment. Needs a reason; the order's payment status and history follow.
  @Post(':id/payments/:paymentId/reverse')
  async reversePayment(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIdPipe) id: number,
    @Param('paymentId', ParseIdPipe) paymentId: number,
    @Body() dto: ReversePaymentDto,
  ) {
    return this.orders.reversePayment(user, id, paymentId, dto);
  }

  // Tell everyone on the order something: text, files, or both.
  @Post(':id/updates')
  @UseInterceptors(ATTACHMENTS)
  async postUpdate(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: PostOrderUpdateDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.orders.postUpdate(user, id, dto, files);
  }

  // Another refund record on a cancelled order (for example "refunded" after the buyer said an earlier one never arrived).
  @Post(':orderId/refunds')
  @UseInterceptors(ATTACHMENTS)
  async addRefund(
    @CurrentUser() user: JwtPayload,
    @Param('orderId', ParseIdPipe) orderId: number,
    @Body() dto: AddRefundRecordDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.orders.addRefund(user, orderId, dto, files);
  }
}
