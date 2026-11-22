import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { DatabaseService } from '../../database/database.service';
import { Seller } from '../../database/entities/seller/seller.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { TokenService } from '../services/token.service';
import { bearerToken } from './role-token';

/**
 * Seller routes, the first of two seller guards. The token must verify under the
 * seller key, and the seller must still exist and have the password the token was
 * issued for. What a seller in a given status may do is decided next by SellerAccessGuard.
 */
@Injectable()
export class SellerAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload; seller?: Seller }>();
    const payload = await this.tokens.verify(AuthUserType.SELLER, bearerToken(request));
    const seller = await this.db.seller.findOne({ where: { id: payload.sub } });
    if (!seller || !this.tokens.matchesPassword(AuthUserType.SELLER, payload, seller.passwordHash)) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    request.user = { sub: seller.id, type: AuthUserType.SELLER };
    request.seller = seller;
    return true;
  }
}
