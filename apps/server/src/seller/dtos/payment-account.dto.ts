import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaymentAccountKind } from '../../database/enums/payment-claim.enum';
import { emptyToNull, trimString } from '../../shared/utils/transform.util';

/** A bank or online wallet account where buyers send money for this seller's orders. */
export class CreatePaymentAccountDto {
  @IsEnum(PaymentAccountKind)
  kind: PaymentAccountKind;

  // "PayPal", "Wise", "Rocket", or the bank's name.
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  provider: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  accountName?: string | null;

  @Transform(trimString)
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  accountNumber: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  branchName?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(200)
  note?: string | null;
}

export class UpdatePaymentAccountDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  provider?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  accountName?: string | null;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  accountNumber?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  branchName?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(200)
  note?: string | null;

  // Switch an account off instead of deleting it: buyers stop seeing it.
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
