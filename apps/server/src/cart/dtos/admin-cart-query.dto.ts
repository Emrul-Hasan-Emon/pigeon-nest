import { Transform, Type } from 'class-transformer';
import {
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
} from 'class-validator';
import { MAX_DECIMAL_12_2, MAX_INT32 } from '../../shared/constants/limits';
import { emptyToUndefined, parseBoolean } from '../../shared/utils/transform.util';

export enum CartState {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum CartOwnerKind {
  CUSTOMER = 'customer',
  GUEST = 'guest',
}


export class ListCartQueryDto {
  // active: carts still being filled. inactive: carts that became an order.
  @IsOptional()
  @IsEnum(CartState)
  state?: CartState;

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

  // name, email or phone of the signed-in customer
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(200)
  customerSearch?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  userId?: number;

  @IsOptional()
  @IsEnum(CartOwnerKind)
  owner?: CartOwnerKind;

  // order the cart became (inactive carts)
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  orderNumber?: string;

  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  hasItems?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_DECIMAL_12_2)
  minTotal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
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
  @IsDateString()
  updatedFrom?: string;

  @IsOptional()
  @IsDateString()
  updatedTo?: string;

  @IsOptional()
  cursor?: string;

  @IsOptional()
  limit?: string;
}
