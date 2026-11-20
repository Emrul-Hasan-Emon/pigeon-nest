import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { HomepageDeviceVisibility } from '../../../database/enums/homepage-device-visibility.enum';
import { HomepageLayout } from '../../../database/enums/homepage-layout.enum';
import { HomepageSectionType } from '../../../database/enums/homepage-section-type.enum';
import {
  HOMEPAGE_MAIN_MAX_SECTIONS,
} from '../../../database/enums/homepage-page.enum';
import { IsDefinedWhenPresent } from '../../../shared/decorators/defined-when-present.decorator';
import { MAX_INT32 } from '../../../shared/constants/limits';
import { parseBoolean, trimString } from '../../../shared/utils/transform.util';

export class CreateHomepageSectionDto {
  @IsEnum(HomepageSectionType)
  sectionType: HomepageSectionType;

  // Falls back to the type's default title.
  @IsDefinedWhenPresent()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @IsDefinedWhenPresent()
  @IsEnum(HomepageLayout)
  layout?: HomepageLayout;

  @IsDefinedWhenPresent()
  @IsEnum(HomepageDeviceVisibility)
  deviceVisibility?: HomepageDeviceVisibility;

  // Default: after the last section.
  @IsDefinedWhenPresent()
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsDefinedWhenPresent()
  @IsBoolean()
  isActive?: boolean;

  // Validated against the section type's registry definition.
  @IsDefinedWhenPresent()
  @IsObject()
  config?: Record<string, unknown>;
}

export class UpdateHomepageSectionDto {
  // Changing the type needs a new config in the same request.
  @IsDefinedWhenPresent()
  @IsEnum(HomepageSectionType)
  sectionType?: HomepageSectionType;

  @IsDefinedWhenPresent()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @IsDefinedWhenPresent()
  @IsEnum(HomepageLayout)
  layout?: HomepageLayout;

  @IsDefinedWhenPresent()
  @IsEnum(HomepageDeviceVisibility)
  deviceVisibility?: HomepageDeviceVisibility;

  @IsDefinedWhenPresent()
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;

  // null clears the date.
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsDateString()
  startsAt?: string | null;

  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsDateString()
  endsAt?: string | null;

  @IsDefinedWhenPresent()
  @IsBoolean()
  isActive?: boolean;

  @IsDefinedWhenPresent()
  @IsObject()
  config?: Record<string, unknown>;
}

// Slots are fixed: only content and look can change.
export class UpdateHomepageSlotDto {
  @IsDefinedWhenPresent()
  @IsEnum(HomepageSectionType)
  sectionType?: HomepageSectionType;

  @IsDefinedWhenPresent()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @IsDefinedWhenPresent()
  @IsEnum(HomepageLayout)
  layout?: HomepageLayout;

  @IsDefinedWhenPresent()
  @IsEnum(HomepageDeviceVisibility)
  deviceVisibility?: HomepageDeviceVisibility;

  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsDateString()
  startsAt?: string | null;

  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsDateString()
  endsAt?: string | null;

  @IsDefinedWhenPresent()
  @IsBoolean()
  isActive?: boolean;

  @IsDefinedWhenPresent()
  @IsObject()
  config?: Record<string, unknown>;
}

export class ReorderHomepageSectionsDto {
  // Every main section id, in the new display order.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(HOMEPAGE_MAIN_MAX_SECTIONS)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_INT32, { each: true })
  ids: number[];
}

export enum HomepageSort {
  NEWEST = 'newest',
  DISPLAY_ORDER = 'displayOrder',
}

export enum HomepageSchedule {
  LIVE = 'live',
  SCHEDULED = 'scheduled',
  EXPIRED = 'expired',
}

export class ListHomepageSectionQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(HomepageSectionType)
  sectionType?: HomepageSectionType;

  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(HomepageDeviceVisibility)
  deviceVisibility?: HomepageDeviceVisibility;

  @IsOptional()
  @IsEnum(HomepageSchedule)
  schedule?: HomepageSchedule;

  // newest (default): id descending. displayOrder: sortOrder, then id.
  @IsOptional()
  @IsEnum(HomepageSort)
  sort?: HomepageSort;

  @IsOptional()
  cursor?: string;

  @IsOptional()
  limit?: string;
}

export class HomepageDeviceQueryDto {
  @IsOptional()
  @IsEnum(['mobile', 'web'])
  device?: 'mobile' | 'web';
}

export class StorefrontHomepageQueryDto {
  @IsOptional()
  @IsEnum(['mobile', 'web'])
  device?: 'mobile' | 'web';

  @IsOptional()
  @IsEnum(['main', 'slots'])
  page?: 'main' | 'slots';
}

