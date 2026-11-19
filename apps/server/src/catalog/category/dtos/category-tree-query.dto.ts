import { IsOptional, IsString } from 'class-validator';

export class CategoryTreeQueryDto {
  @IsOptional()
  @IsString()
  categoryName?: string;
}
