import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangeUserPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword: string;

  // bcrypt only uses the first 72 bytes, so longer passwords are refused.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}
