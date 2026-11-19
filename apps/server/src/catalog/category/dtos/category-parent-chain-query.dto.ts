import { IsNotEmpty, IsString } from 'class-validator';

export class CategoryParentChainQueryDto {
  @IsString()
  @IsNotEmpty()
  categoryIds: string;
}
