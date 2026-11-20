import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { DatabaseService } from '../../database/database.service';
import { User } from '../../database/entities/person/user.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { USER_ACCESS_KEY } from '../decorators/require-user-access.decorator';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { getUserAccess, UserAccessLevel } from '../policies/user-access.policy';

// Run after AuthGuard + RolesGuard on user routes. Re-reads the user on every
// request so an admin suspending or reactivating takes effect immediately,
// even for tokens issued earlier.
@Injectable()
export class UserAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly databaseService: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & { user?: JwtPayload; userAccount?: User }
    >();
    const payload = request.user;
    if (!payload || payload.type !== AuthUserType.USER) {
      throw new UnauthorizedException();
    }

    const user = await this.databaseService.user.findOne({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('User account no longer exists');
    }
    request.userAccount = user;

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
