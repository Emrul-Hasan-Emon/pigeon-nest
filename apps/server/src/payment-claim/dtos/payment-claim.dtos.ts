import { Transform, Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PaymentClaimStatus } from '../../database/enums/payment-claim.enum';
import { MAX_DECIMAL_12_2 } from '../../shared/constants/limits';
import { PageQueryDto } from '../../shared/utils/page-paginate.util';
import { emptyToUndefined, trimString } from '../../shared/utils/transform.util';

// Multipart numbers arrive as text.
const toNumber = ({ value }: { value: unknown }): unknown => (typeof value === 'string' && value.trim() !== '' ? Number(value) : value);

/** Mark as paid request: multipart, with the amount, the transaction ID, how it was paid, and at least one `files` proof. */
export class CreatePaymentClaimDto {
  @Transform(toNumber)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_DECIMAL_12_2)
  amount: number;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Write the transaction ID' })
  @MaxLength(120)
  transactionId: string;

  // How the money was sent: PayPal, Wise, bank transfer...
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Say how you paid (PayPal, Wise, bank...)' })
  @MaxLength(60)
  method: string;

  // The number or account the money was sent from.
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(40)
  senderNumber?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  paidOn?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(1000)
  note?: string;
}

/** The seller or admin confirms the claim: the money is recorded on the order. They may change the amount they actually received. */
export class ConfirmPaymentClaimDto {
  @IsOptional()
  @Transform(toNumber)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_DECIMAL_12_2)
  amount?: number;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RejectPaymentClaimDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

export class ListPaymentClaimsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(PaymentClaimStatus)
  status?: PaymentClaimStatus;

  @IsOptional()
  @Type(() => Number)
  sellerId?: number;
}
