import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../database/entities/person/user.entity';

// The user loaded fresh from the DB by UserAccessGuard.
export const CurrentUserAccount = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    return ctx.switchToHttp().getRequest().userAccount;
  },
);
