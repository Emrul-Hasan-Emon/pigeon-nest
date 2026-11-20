import { IsObject } from 'class-validator';

export class UpdateSettingsDto {
  // { "shipping.defaultCharge": 120, ... } - validated per key by the service.
  @IsObject()
  settings: Record<string, unknown>;
}
