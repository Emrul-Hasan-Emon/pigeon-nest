import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaymentGatewayType } from '../../database/enums/payment-gateway-type.enum';
import { IsDefinedWhenPresent } from '../../shared/decorators/defined-when-present.decorator';
import {
  emptyToNull,
  emptyToUndefined,
  parseBoolean,
  trimString,
} from '../../shared/utils/transform.util';

// Multipart form: the optional file field is `icon`.
export class CreatePaymentGatewayDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsEnum(PaymentGatewayType)
  type: PaymentGatewayType;

  // Instructions shown to the customer (plain text).
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(255)
  accountName?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  accountNumber?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(255)
  bankName?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(255)
  branchName?: string;

  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePaymentGatewayDto {
  @IsDefinedWhenPresent()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsDefinedWhenPresent()
  @IsEnum(PaymentGatewayType)
  type?: PaymentGatewayType;

  // A blank value clears the field.
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(255)
  accountName?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(100)
  accountNumber?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(255)
  bankName?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(255)
  branchName?: string | null;

  @IsDefinedWhenPresent()
  @Transform(parseBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsDefinedWhenPresent()
  @Transform(parseBoolean)
  @IsBoolean()
  removeIcon?: boolean;
}

export class ListPaymentGatewayQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(PaymentGatewayType)
  type?: PaymentGatewayType;

  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  cursor?: string;

  @IsOptional()
  limit?: string;
}
