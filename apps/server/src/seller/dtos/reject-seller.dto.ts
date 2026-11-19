import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectSellerDto {
  // Shown to the seller. Blank is treated as "no reason".
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
