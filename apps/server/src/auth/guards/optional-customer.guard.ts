import {
  BadRequestException,
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { DatabaseService } from '../../database/database.service';
import { User } from '../../database/entities/person/user.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { getUserAccess } from '../policies/user-access.policy';

/** Header carrying a guest's cart session id. */
export const CART_SESSION_HEADER = 'x-cart-session';
const SESSION_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;

/** Whose cart a request is about: a signed-in customer, or a guest session. */
export interface CartOwner {
  userId: number | null;
  sessionId: string | null;
}

// For routes guests may use (cart, checkout). A bearer token, when sent, must be
// a valid, active customer; without one the request is a guest identified by
// the x-cart-session header (which may be missing on read-only calls).
@Injectable()
export class OptionalCustomerGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & { user?: JwtPayload; userAccount?: User; cartOwner?: CartOwner }
    >();

    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme === 'Bearer' && token) {
      let payload: JwtPayload;
      try {
        payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
          secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        });
      } catch {
        throw new UnauthorizedException('Invalid or expired token');
      }
      if (payload.type !== AuthUserType.USER) {
        throw new ForbiddenException('Only customer accounts can use a cart');
      }
      const user = await this.db.user.findOne({ where: { id: payload.sub } });
      if (!user) throw new UnauthorizedException('User account no longer exists');
      const access = getUserAccess(user);
      if (!access.canUse) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Forbidden',
          message: access.reason,
          code: access.code,
        });
      }
      request.user = payload;
      request.userAccount = user;
      request.cartOwner = { userId: user.id, sessionId: null };
      return true;
    }

    const raw = request.headers[CART_SESSION_HEADER];
    const session = Array.isArray(raw) ? raw[0] : raw;
    if (session !== undefined && !SESSION_PATTERN.test(session.trim())) {
      throw new BadRequestException(
        `${CART_SESSION_HEADER} must be 8-100 letters, digits, "-" or "_"`,
      );
    }
    request.cartOwner = { userId: null, sessionId: session?.trim() ?? null };
    return true;
  }
}

export const CurrentCartOwner = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CartOwner =>
    ctx.switchToHttp().getRequest().cartOwner,
);
