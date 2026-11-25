import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trimString } from '../../shared/utils/transform.util';

/** The phone's push token, sent by the seller app after sign-in. */
export class RegisterDeviceDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;

  @IsIn(['android', 'ios'])
  platform: 'android' | 'ios';
}

/** Sent on sign-out so the phone stops getting this shop's notifications. */
export class UnregisterDeviceDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;
}
