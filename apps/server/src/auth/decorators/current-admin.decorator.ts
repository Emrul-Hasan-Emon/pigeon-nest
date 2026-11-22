import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AdminUser } from '../../database/entities/person/admin-user.entity';

// The admin loaded fresh from the DB by AdminAuthGuard.
export const CurrentAdmin = createParamDecorator((_data: unknown, ctx: ExecutionContext): AdminUser => {
  return ctx.switchToHttp().getRequest().admin;
});
