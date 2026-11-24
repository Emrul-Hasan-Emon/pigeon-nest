import { Injectable } from '@nestjs/common';
import { Seller } from '../../database/entities/seller/seller.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { CursorPagination } from '../../shared/decorators/cursor-pagination-params.decorator';
import { PageRequest } from '../../shared/utils/page-paginate.util';
import { CreateAddressDto } from '../../user/dtos/address.dtos';
import { AddressService } from '../../user/services/address.service';
import {
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

const { SELLER } = AuthUserType;

/** What a seller does with their own orders, payments and refunds. Every call is limited to that seller's shop. */
@Injectable()
export class SellerOrderService {
  constructor(
    private readonly common: CommonOrderService,
    private readonly addresses: AddressService,
  ) {}

  private actor(seller: Seller) {
    return { id: seller.id, type: SELLER, name: seller.name };
  }

  // ---- orders ----

  list(seller: Seller, query: ListStaffOrderQueryDto, pagination: CursorPagination) {
    return this.common.listOrders({ ...query, sellerId: undefined, sellerSearch: undefined }, pagination, SELLER, {
      sellerId: seller.id,
    });
  }

  customers(q: string) {
    return this.common.findCustomers(q);
  }

  // While entering an order: the customer's saved addresses to pick from...
  async customerAddresses(userId: number) {
    await this.addresses.ensureUser(userId);
    return this.addresses.list(userId);
  }

  // ...and a way to save a new one to the customer's address book.
  async saveCustomerAddress(seller: Seller, userId: number, dto: CreateAddressDto) {
    await this.addresses.ensureActiveUser(userId);
    return this.addresses.create(userId, dto, this.actor(seller));
  }

  catalog(seller: Seller, query: StaffCatalogQueryDto) {
    return this.common.catalog(query, { sellerId: seller.id });
  }

  options(countryCode: string | undefined, subtotal: number | undefined) {
    return this.common.orderOptions(countryCode, subtotal);
  }

  create(seller: Seller, dto: CreateStaffOrderDto) {
    return this.common.createOrder(dto, this.actor(seller), { sellerId: seller.id });
  }

  bulkStatus(seller: Seller, dto: BulkChangeOrderStatusDto) {
    return this.common.bulkChangeStatus(dto, this.actor(seller), { sellerId: seller.id });
  }

  details(seller: Seller, id: number) {
    return this.common.orderDetail(id, SELLER, { sellerId: seller.id });
  }

  changeStatus(seller: Seller, id: number, dto: ChangeOrderStatusDto) {
    return this.common.changeStatus(id, dto, this.actor(seller), SELLER, { sellerId: seller.id });
  }

  // ---- payments ----

  listPayments(seller: Seller, query: ListPaymentQueryDto, pagination: CursorPagination) {
    return this.common.listPayments({ ...query, sellerId: undefined }, pagination, seller.id);
  }

  paymentDetails(seller: Seller, id: number) {
    return this.common.paymentDetails(id, seller.id);
  }

  recordPayment(seller: Seller, id: number, dto: RecordPaymentDto, files?: Express.Multer.File[]) {
    return this.common.record(id, dto, files, this.actor(seller), { sellerId: seller.id });
  }

  reversePayment(seller: Seller, id: number, paymentId: number, dto: ReversePaymentDto) {
    return this.common.reverse(id, paymentId, dto, this.actor(seller), { sellerId: seller.id });
  }

  postUpdate(seller: Seller, id: number, dto: PostOrderUpdateDto, files?: Express.Multer.File[]) {
    return this.common.postUpdate(id, dto, files, this.actor(seller), { sellerId: seller.id });
  }

  // ---- refunds ----

  listRefunds(seller: Seller, query: ListRefundsQueryDto, page: PageRequest) {
    return this.common.listRefunds(query, page, { sellerId: seller.id });
  }

  refundSummary(seller: Seller) {
    return this.common.refundSummary({ sellerId: seller.id });
  }

  refundDetail(seller: Seller, id: number) {
    return this.common.refundDetail(id, { sellerId: seller.id });
  }

  changeRefund(seller: Seller, id: number, dto: ChangeRefundStatusDto, files?: Express.Multer.File[]) {
    return this.common.changeRefund(id, dto, files, this.actor(seller), { sellerId: seller.id });
  }
}
