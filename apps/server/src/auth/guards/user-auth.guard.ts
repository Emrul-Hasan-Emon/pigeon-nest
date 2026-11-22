import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { DatabaseService } from '../../database/database.service';
import { User } from '../../database/entities/person/user.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { TokenService } from '../services/token.service';
import { bearerToken } from './role-token';

/**
 * Customer routes, the first of two customer guards. The token must verify under the
 * customer key, and the customer must still exist and have the password the token was
 * issued for. What a customer in a given status may do is decided next by UserAccessGuard.
 */
@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload; userAccount?: User }>();
    const payload = await this.tokens.verify(AuthUserType.USER, bearerToken(request));
    const user = await this.db.user.findOne({ where: { id: payload.sub } });
    if (!user || !this.tokens.matchesPassword(AuthUserType.USER, payload, user.passwordHash)) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    request.user = { sub: user.id, type: AuthUserType.USER };
    request.userAccount = user;
    return true;
  }
}
