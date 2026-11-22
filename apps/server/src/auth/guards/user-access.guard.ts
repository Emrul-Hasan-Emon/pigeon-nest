import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { User } from '../../database/entities/person/user.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { USER_ACCESS_KEY } from '../decorators/require-user-access.decorator';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { getUserAccess, UserAccessLevel } from '../policies/user-access.policy';

// Runs after UserAuthGuard, which has verified the token and loaded the customer. Decides what a
// customer in the current status may do. The customer is re-read on every request, so an admin
// suspending or reactivating takes effect immediately, even for tokens issued earlier.
@Injectable()
export class UserAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload; userAccount?: User }>();
    const user = request.userAccount;
    if (!user || request.user?.type !== AuthUserType.USER || request.user.sub !== user.id) {
      throw new UnauthorizedException();
    }

    const level =
      this.reflector.getAllAndOverride<UserAccessLevel>(USER_ACCESS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'full';
    if (level === 'any') {
      return true;
    }

    const access = getUserAccess(user);
    if (!access.canUse) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: access.reason,
        code: access.code,
      });
    }
    return true;
  }
}
