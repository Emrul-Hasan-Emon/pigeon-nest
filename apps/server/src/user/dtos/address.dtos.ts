import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AddressType } from '../../database/enums/address-type.enum';
import { COUNTRY_CODES } from '../../settings/utils/countries';
import { IsDefinedWhenPresent } from '../../shared/decorators/defined-when-present.decorator';
import { emptyToNull, emptyToUndefined, trimString } from '../../shared/utils/transform.util';
import { IsInternationalPhone } from '../../shared/validators/international-phone.decorator';

const upperTrim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
const COUNTRY_MESSAGE = 'countryCode must be a 2-letter country code, e.g. BD';

export class CreateAddressDto {
  @IsDefinedWhenPresent()
  @IsEnum(AddressType)
  type?: AddressType;

  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  recipientName: string;

  @IsInternationalPhone()
  phone: string;

  @Transform(upperTrim)
  @IsIn([...COUNTRY_CODES], { message: COUNTRY_MESSAGE })
  countryCode: string;

  // State, province or division.
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(120)
  state?: string;

  // City or district.
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  city: string;

  // The address in words: house, road, area, landmarks.
  @Transform(trimString)
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  address: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(20)
  zipCode?: string;

  @IsDefinedWhenPresent()
  @IsBoolean()
  isDefault?: boolean;
}

/** Every field optional. A blank (or null) state or zipCode clears it. */
export class UpdateAddressDto {
  @IsDefinedWhenPresent()
  @IsEnum(AddressType)
  type?: AddressType;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  recipientName?: string;

  @IsOptional()
  @IsInternationalPhone()
  phone?: string;

  @IsOptional()
  @Transform(upperTrim)
  @IsIn([...COUNTRY_CODES], { message: COUNTRY_MESSAGE })
  countryCode?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  state?: string | null;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(20)
  zipCode?: string | null;

  // true makes this the default (and the old default stops being one).
  @IsDefinedWhenPresent()
  @IsBoolean()
  isDefault?: boolean;
}
