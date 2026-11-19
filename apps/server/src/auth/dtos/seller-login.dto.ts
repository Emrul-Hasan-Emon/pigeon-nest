import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsInternationalPhone } from '../../shared/validators/international-phone.decorator';

export class SellerLoginDto {
  @IsInternationalPhone()
  phone: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}
