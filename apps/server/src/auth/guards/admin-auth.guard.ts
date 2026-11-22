import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { DatabaseService } from '../../database/database.service';
import { AdminUser } from '../../database/entities/person/admin-user.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { TokenService } from '../services/token.service';
import { bearerToken } from './role-token';

/**
 * Admin routes. The token must verify under the admin key, and the admin must still
 * exist, be active and have the password the token was issued for. Checked on every
 * request, so deactivating an admin or changing their password ends their sessions.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload; admin?: AdminUser }>();
    const payload = await this.tokens.verify(AuthUserType.ADMIN, bearerToken(request));
    const admin = await this.db.adminUser.findOne({ where: { id: payload.sub } });
    if (!admin || !admin.isActive || !this.tokens.matchesPassword(AuthUserType.ADMIN, payload, admin.passwordHash)) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    request.user = { sub: admin.id, type: AuthUserType.ADMIN };
    request.admin = admin;
    return true;
  }
}
