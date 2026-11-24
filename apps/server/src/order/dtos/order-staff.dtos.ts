import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  ValidateNested,
  Length,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { DeliveryType } from '../../database/enums/delivery-type.enum';
import { OrderStatus } from '../../database/enums/order-status.enum';
import { PaymentStatus } from '../../database/enums/payment-status.enum';
import { RefundStatus } from '../../database/enums/refund-status.enum';
import { PageQueryDto } from '../../shared/utils/page-paginate.util';
import { PlaceOrderDto } from './order.dtos';
import { MAX_DECIMAL_12_2, MAX_INT32 } from '../../shared/constants/limits';
import { emptyToUndefined, parseBoolean, trimString } from '../../shared/utils/transform.util';

// Multipart bodies arrive as strings.
const toNumber = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? (value.trim() === '' ? undefined : Number(value)) : value;

/** Marking an order paid (fully or in part). Files come as multipart `files`. */
export class RecordPaymentDto {
  // What was received now. Left out, the whole balance due.
  @IsOptional()
  @Transform(toNumber)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_DECIMAL_12_2)
  amount?: number;

  @Transform(trimString)
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  description: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  transactionId?: string;

  // When the money arrived. Left out, now.
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  paidAt?: string;
}

/** Undoing a recorded payment. The reason goes into the payment history. */
export class ReversePaymentDto {
  @Transform(trimString)
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason: string;
}

export class PostOrderUpdateDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(2000)
  message?: string;
}

export class ListPaymentQueryDto {
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  orderId?: number;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(60)
  orderNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  gatewayId?: number;

  // Admin only; a seller's own payments are always the only ones.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  sellerId?: number;

  // The buyer's name, phone or email.
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(200)
  customerSearch?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  transactionId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_DECIMAL_12_2)
  minAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_DECIMAL_12_2)
  maxAmount?: number;

  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  hasAttachments?: boolean;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsDateString()
  paidFrom?: string;

  @IsOptional()
  @IsDateString()
  paidTo?: string;

  // true: only reversed receipts. false: leave them out.
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  reversed?: boolean;

  // Read by the cursor decorator; listed so the whitelist lets them through.
  @IsOptional()
  cursor?: string;

  @IsOptional()
  limit?: string;
}

// ---- order lists, status changes and order entry (admin and seller) ----

export enum OrderOwnerKind {
  CUSTOMER = 'customer',
  GUEST = 'guest',
}

export class ListStaffOrderQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  // Admin only; a seller only ever sees their own orders.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  sellerId?: number;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(200)
  sellerSearch?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  userId?: number;

  // Recipient or account name, phone or email.
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(200)
  customerSearch?: string;

  @IsOptional()
  @IsEnum(OrderOwnerKind)
  owner?: OrderOwnerKind;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(60)
  orderNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  gatewayId?: number;

  @IsOptional()
  @IsEnum(DeliveryType)
  deliveryType?: DeliveryType;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_DECIMAL_12_2)
  minTotal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_DECIMAL_12_2)
  maxTotal?: number;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  cursor?: string;

  @IsOptional()
  limit?: string;
}

export class ChangeOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Move several orders to one new status at once. They must all be in the same status now. */
export class BulkChangeOrderStatusDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_INT32, { each: true })
  orderIds: number[];

  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CustomerSearchQueryDto {
  // An email address or a mobile number.
  @Transform(trimString)
  @IsString()
  @MinLength(5)
  @MaxLength(100)
  q: string;
}

export class StaffCatalogQueryDto {
  // Admin must say which seller; a seller's own is used regardless.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  sellerId?: number;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class StaffOrderOptionsQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  // The items' total, so each delivery option shows what the order would cost.
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_DECIMAL_12_2)
  subtotal?: number;
}

export class StaffOrderItemDto {
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  sellerProductId: number;

  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  sellerProductSkuId: number;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;
}

/** An order a seller or admin enters for a customer. Prices come from the live SKUs. */
export class CreateStaffOrderDto extends PlaceOrderDto {
  // Admin must give it; a seller's own is used.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  sellerId?: number;

  // The customer's account, from the email or mobile search. Left out: a walk-in customer.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  userId?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => StaffOrderItemDto)
  items: StaffOrderItemDto[];
}

// ---- refunds of cancelled orders ----

/** Moving a refund on. Files come as multipart `files`. `amount`, `note` and proof matter when the status becomes refunded. */
export class ChangeRefundStatusDto {
  @IsEnum(RefundStatus)
  status: RefundStatus;

  // What was sent back. Must be exactly what the buyer paid.
  @IsOptional()
  @Transform(toNumber)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_DECIMAL_12_2)
  amount?: number;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(120)
  transactionId?: string;
}

/** An admin adds another refund record, for example when a buyer says an earlier one never arrived. Status defaults to refunded. */
export class AddRefundRecordDto {
  @IsOptional()
  @IsEnum(RefundStatus)
  status?: RefundStatus;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_DECIMAL_12_2)
  amount?: number;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(120)
  transactionId?: string;
}

export class ListRefundsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(RefundStatus)
  status?: RefundStatus;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  search?: string;
}
