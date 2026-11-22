import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Seller } from '../../database/entities/seller/seller.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { SELLER_ACCESS_KEY } from '../decorators/require-seller-access.decorator';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import {
  getSellerAccess,
  SellerAccessLevel,
} from '../policies/seller-access.policy';

// Runs after SellerAuthGuard, which has verified the token and loaded the seller. Decides what a
// seller in the current status may do. The seller is re-read on every request, so an admin
// approving, rejecting or suspending takes effect immediately, even for tokens issued earlier.
@Injectable()
export class SellerAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload; seller?: Seller }>();
    const seller = request.seller;
    if (!seller || request.user?.type !== AuthUserType.SELLER || request.user.sub !== seller.id) {
      throw new UnauthorizedException();
    }

    const level =
      this.reflector.getAllAndOverride<SellerAccessLevel>(SELLER_ACCESS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'full';
    if (level === 'any') {
      return true;
    }

    const access = getSellerAccess(seller);
    const allowed = level === 'profile' ? access.canEditProfile : access.canManage;
    if (!allowed) {
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
