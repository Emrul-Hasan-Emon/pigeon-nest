import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
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
import { COUNTRY_CODES } from '../../settings/utils/countries';
import { MAX_INT32 } from '../../shared/constants/limits';
import { PageQueryDto } from '../../shared/utils/page-paginate.util';
import { emptyToUndefined, trimString } from '../../shared/utils/transform.util';
import { IsInternationalPhone } from '../../shared/validators/international-phone.decorator';

const upperTrim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CheckoutOptionsQueryDto {
  // Where the order will be delivered; prices the delivery options.
  @IsOptional()
  @Transform(upperTrim)
  @IsIn([...COUNTRY_CODES], { message: 'countryCode must be a 2-letter country code' })
  countryCode?: string;
}

/** Everything a customer or guest gives at checkout. Prices are never sent. */
export class PlaceOrderDto {
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  recipientName: string;

  @IsInternationalPhone()
  recipientPhone: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string;

  @Transform(upperTrim)
  @IsIn([...COUNTRY_CODES], { message: 'countryCode must be a 2-letter country code' })
  countryCode: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(120)
  state?: string;

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  city: string;

  @Transform(trimString)
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  addressLine: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsEnum(DeliveryType)
  deliveryType: DeliveryType;

  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  paymentGatewayId: number;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(1000)
  note?: string;

  // What the chosen gateway asks for as proof of payment (see the gateway's
  // proofFields). Checked against that gateway in the service.
  @IsOptional()
  @IsObject()
  paymentProof?: Record<string, unknown>;

  // The items total the customer saw. If the cart's live total is different now
  // (a price or an accepted offer changed), the order is refused with 409.
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  expectedItemsTotal?: number;
}

export class UserOrderQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  // Matches the order number.
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(60)
  search?: string;
}

export class CancelOrderDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class TrackOrderQueryDto {
  @Transform(trimString)
  @IsString()
  @MinLength(4)
  @MaxLength(60)
  orderNumber: string;

  @IsInternationalPhone()
  phone: string;
}
