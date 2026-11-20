import { IsInt, IsString, Matches, Max, Min } from 'class-validator';
import { MAX_INT32 } from '../../shared/constants/limits';
import { IsDefinedWhenPresent } from '../../shared/decorators/defined-when-present.decorator';

export const MAX_LINE_QUANTITY = 99;

export class AddCartItemDto {
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  sellerProductId: number;

  // Which variant. Left out, the default (or cheapest in-stock) SKU is used.
  @IsDefinedWhenPresent()
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  sellerProductSkuId?: number;

  @IsDefinedWhenPresent()
  @IsInt()
  @Min(1)
  @Max(MAX_LINE_QUANTITY)
  quantity?: number;
}

export class UpdateCartItemDto {
  @IsInt()
  @Min(1)
  @Max(MAX_LINE_QUANTITY)
  quantity: number;
}

export class MergeCartDto {
  // The guest cart session being folded into the signed-in customer's carts.
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{8,100}$/, { message: 'sessionId is not a valid cart session' })
  sessionId: string;
}

