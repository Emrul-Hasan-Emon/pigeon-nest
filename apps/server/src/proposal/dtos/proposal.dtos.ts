import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { MAX_DECIMAL_12_2, MAX_INT32 } from '../../shared/constants/limits';
import { emptyToUndefined } from '../../shared/utils/transform.util';
import { ProposalParty, SkuPriceProposalStatus } from '../../database/enums/sku-price-proposal.enums';

const MONEY = { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false };

// cursor and limit are read by @CursorPaginationParams(); listed so the whitelist lets them through.
class Paged {
  @IsOptional()
  cursor?: string;

  @IsOptional()
  limit?: string;
}

class Note {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Buyer starts a proposal for one SKU. */
export class CreateProposalDto extends Note {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  sellerProductSkuId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  quantity: number;

  // per unit
  @Type(() => Number)
  @IsNumber(MONEY)
  @Min(0.01)
  @Max(MAX_DECIMAL_12_2)
  price: number;
}

/** A counter: a new price, and optionally a new quantity. */
export class CounterProposalDto extends Note {
  @Type(() => Number)
  @IsNumber(MONEY)
  @Min(0.01)
  @Max(MAX_DECIMAL_12_2)
  price: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  quantity?: number;
}

/** Accept, reject or cancel, with an optional message. */
export class ProposalNoteDto extends Note {}

class ListBase extends Paged {
  @IsOptional()
  @IsEnum(SkuPriceProposalStatus)
  status?: SkuPriceProposalStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  sellerProductSkuId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  productId?: number;

  // product name
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(200)
  search?: string;

  // pending only: whose answer it waits for
  @IsOptional()
  @IsEnum(ProposalParty)
  awaiting?: ProposalParty;

  // SKU code
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  skuSearch?: string;

  // offered on or after this day / on or before this day (YYYY-MM-DD)
  @IsOptional()
  @Transform(emptyToUndefined)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  // per-unit price in the latest offer
  @IsOptional()
  @Type(() => Number)
  @IsNumber(MONEY)
  @Min(0)
  @Max(MAX_DECIMAL_12_2)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(MONEY)
  @Min(0)
  @Max(MAX_DECIMAL_12_2)
  maxPrice?: number;
}

export class ListUserProposalsQueryDto extends ListBase {}

export class ListSellerProposalsQueryDto extends ListBase {
  // buyer name, email or phone
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(200)
  buyerSearch?: string;
}

export class ListAdminProposalsQueryDto extends ListSellerProposalsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  userId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  sellerId?: number;

  // seller name
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(200)
  sellerSearch?: string;
}
