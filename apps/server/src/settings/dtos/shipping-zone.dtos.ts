import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DeliveryType } from '../../database/enums/delivery-type.enum';
import { MAX_DECIMAL_12_2 } from '../../shared/constants/limits';
import { IsDefinedWhenPresent } from '../../shared/decorators/defined-when-present.decorator';
import { parseBoolean, trimString } from '../../shared/utils/transform.util';

const upperCodes = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? value.map((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v))
    : value;

export class CreateShippingZoneDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsEnum(DeliveryType)
  deliveryType: DeliveryType;

  // ISO 3166-1 alpha-2 codes; whether each one is a real country is checked in the service.
  @Transform(upperCodes)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(249)
  @ArrayUnique()
  @Matches(/^[A-Z]{2}$/, { each: true, message: 'each country code must be two letters' })
  countryCodes: string[];

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_DECIMAL_12_2)
  charge: number;

  @IsInt()
  @Min(0)
  @Max(365)
  estimatedDays: number;

  @IsDefinedWhenPresent()
  @IsBoolean()
  supportsLiveAnimal?: boolean;

  @IsDefinedWhenPresent()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateShippingZoneDto {
  @IsDefinedWhenPresent()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsDefinedWhenPresent()
  @IsEnum(DeliveryType)
  deliveryType?: DeliveryType;

  @IsDefinedWhenPresent()
  @Transform(upperCodes)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(249)
  @ArrayUnique()
  @Matches(/^[A-Z]{2}$/, { each: true, message: 'each country code must be two letters' })
  countryCodes?: string[];

  @IsDefinedWhenPresent()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_DECIMAL_12_2)
  charge?: number;

  @IsDefinedWhenPresent()
  @IsInt()
  @Min(0)
  @Max(365)
  estimatedDays?: number;

  @IsDefinedWhenPresent()
  @IsBoolean()
  supportsLiveAnimal?: boolean;

  @IsDefinedWhenPresent()
  @IsBoolean()
  isActive?: boolean;
}

export class ListShippingZoneQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(DeliveryType)
  deliveryType?: DeliveryType;

  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  isActive?: boolean;

  // zones that cover this country
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z]{2}$/, { message: 'country must be a two-letter code' })
  country?: string;

  @IsOptional()
  cursor?: string;

  @IsOptional()
  limit?: string;
}

export class ShippingQuoteQueryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z]{2}$/, { message: 'country must be a two-letter code' })
  country: string;

  @IsEnum(DeliveryType)
  deliveryType: DeliveryType;
}

