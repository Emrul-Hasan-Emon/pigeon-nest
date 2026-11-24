import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { CursorPagination } from '../../shared/decorators/cursor-pagination-params.decorator';
import { ActorResolverService } from '../../shared/services/actor-resolver.service';
import { PageRequest } from '../../shared/utils/page-paginate.util';
import {
  AddRefundRecordDto,
  BulkChangeOrderStatusDto,
  ChangeOrderStatusDto,
  ChangeRefundStatusDto,
  CreateStaffOrderDto,
  ListPaymentQueryDto,
  ListRefundsQueryDto,
  ListStaffOrderQueryDto,
  PostOrderUpdateDto,
  RecordPaymentDto,
  ReversePaymentDto,
  StaffCatalogQueryDto,
} from '../dtos/order-staff.dtos';
import { CommonOrderService } from './common-order.service';

const { ADMIN } = AuthUserType;

/** What an admin does with orders, their payments and their refunds. An admin sees every shop, so no seller limit is set. */
@Injectable()
export class AdminOrderService {
  constructor(
    private readonly common: CommonOrderService,
    private readonly actors: ActorResolverService,
  ) {}

  // ---- orders ----

  list(query: ListStaffOrderQueryDto, pagination: CursorPagination) {
    return this.common.listOrders(query, pagination, ADMIN);
  }

  customers(q: string) {
    return this.common.findCustomers(q);
  }

  catalog(query: StaffCatalogQueryDto) {
    return this.common.catalog(query, {});
  }

  options(countryCode: string | undefined, subtotal: number | undefined) {
    return this.common.orderOptions(countryCode, subtotal);
  }

  async create(user: JwtPayload, dto: CreateStaffOrderDto) {
    return this.common.createOrder(dto, await this.actors.resolve(user), {});
  }

  async bulkStatus(user: JwtPayload, dto: BulkChangeOrderStatusDto) {
    return this.common.bulkChangeStatus(dto, await this.actors.resolve(user), {});
  }

  details(id: number) {
    return this.common.orderDetail(id, ADMIN);
  }

  async changeStatus(user: JwtPayload, id: number, dto: ChangeOrderStatusDto) {
    return this.common.changeStatus(id, dto, await this.actors.resolve(user), ADMIN);
  }

  // ---- payments ----

  listPayments(query: ListPaymentQueryDto, pagination: CursorPagination) {
    return this.common.listPayments(query, pagination);
  }

  paymentDetails(id: number) {
    return this.common.paymentDetails(id);
  }

  async recordPayment(user: JwtPayload, id: number, dto: RecordPaymentDto, files?: Express.Multer.File[]) {
    return this.common.record(id, dto, files, await this.actors.resolve(user));
  }

  async reversePayment(user: JwtPayload, id: number, paymentId: number, dto: ReversePaymentDto) {
    return this.common.reverse(id, paymentId, dto, await this.actors.resolve(user));
  }

  async postUpdate(user: JwtPayload, id: number, dto: PostOrderUpdateDto, files?: Express.Multer.File[]) {
    return this.common.postUpdate(id, dto, files, await this.actors.resolve(user));
  }

  // ---- refunds ----

  listRefunds(query: ListRefundsQueryDto, page: PageRequest) {
    return this.common.listRefunds(query, page, {});
  }

  refundSummary() {
    return this.common.refundSummary({});
  }

  refundDetail(id: number) {
    return this.common.refundDetail(id, {});
  }

  async changeRefund(user: JwtPayload, id: number, dto: ChangeRefundStatusDto, files?: Express.Multer.File[]) {
    return this.common.changeRefund(id, dto, files, await this.actors.resolve(user), {});
  }

  async addReturnMoneyRecord(user: JwtPayload, returnId: number, dto: AddRefundRecordDto, files?: Express.Multer.File[]) {
    return this.common.addForReturn(returnId, dto, files, await this.actors.resolve(user));
  }

  async addRefund(user: JwtPayload, orderId: number, dto: AddRefundRecordDto, files?: Express.Multer.File[]) {
    return this.common.addForOrder(orderId, dto, files, await this.actors.resolve(user));
  }
}
