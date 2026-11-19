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
import { Seller } from '../../database/entities/seller/seller.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { SELLER_ACCESS_KEY } from '../decorators/require-seller-access.decorator';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import {
  getSellerAccess,
  SellerAccessLevel,
} from '../policies/seller-access.policy';

// Run after AuthGuard + RolesGuard on seller routes. Re-reads the seller on
// every request so an admin approving, rejecting or suspending takes effect
// immediately, even for tokens issued earlier.
@Injectable()
export class SellerAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly databaseService: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & { user?: JwtPayload; seller?: Seller }
    >();
    const user = request.user;
    if (!user || user.type !== AuthUserType.SELLER) {
      throw new UnauthorizedException();
    }

    const seller = await this.databaseService.seller.findOne({
      where: { id: user.sub },
    });
    if (!seller) {
      throw new UnauthorizedException('Seller account no longer exists');
    }
    request.seller = seller;

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
