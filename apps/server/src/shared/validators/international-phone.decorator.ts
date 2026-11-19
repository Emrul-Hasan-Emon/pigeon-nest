import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { registerDecorator, ValidationOptions } from 'class-validator';
import { normalizePhone, PHONE_FORMAT_MESSAGE } from '../utils/phone.util';

// Validates an international phone number (with country code) and rewrites it
// to canonical E.164 before the DTO reaches the service.
export function IsInternationalPhone(options?: ValidationOptions) {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => normalizePhone(value) ?? value),
    (target: object, propertyName: string | symbol) =>
      registerDecorator({
        name: 'isInternationalPhone',
        target: target.constructor,
        propertyName: propertyName as string,
        options: { message: PHONE_FORMAT_MESSAGE, ...options },
        validator: {
          validate: (value: unknown) =>
            typeof value === 'string' && normalizePhone(value) === value,
        },
      }),
  );
}
