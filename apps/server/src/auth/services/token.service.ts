import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHmac, randomUUID } from 'crypto';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

const ISSUER = 'pigeon-nest';
const ALGORITHM = 'HS256';
const MIN_SECRET_LENGTH = 32;
const SECRET_NAMES: Record<AuthUserType, string> = {
  [AuthUserType.ADMIN]: 'JWT_ADMIN_SECRET',
  [AuthUserType.SELLER]: 'JWT_SELLER_SECRET',
  [AuthUserType.USER]: 'JWT_USER_SECRET',
};

/**
 * Signs and verifies access tokens, one signing key per role.
 *
 * A token is only trusted when it verifies under the key, audience, issuer and
 * algorithm of the role the route asks for. The `type` claim is never what decides
 * the role: a seller token fails on an admin route because the signature does not
 * match, even if its claims are edited. Each role's key comes from its own
 * `JWT_<ROLE>_SECRET`, else it is derived from `JWT_ACCESS_SECRET` for that role.
 *
 * `pwd` ties a token to the account's current password, so changing the password
 * ends every older token.
 */
@Injectable()
export class TokenService {
  private readonly log = new Logger(TokenService.name);
  private readonly keys = new Map<AuthUserType, string>();
  private readonly lifetime: number;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    const base = config.get<string>('JWT_ACCESS_SECRET') ?? '';
    this.lifetime = Number(config.get<string>('JWT_ACCESS_EXPIRES_IN', '900'));
    for (const role of Object.values(AuthUserType)) {
      const own = config.get<string>(SECRET_NAMES[role]);
      const key = own || (base ? createHmac('sha256', base).update(`pigeon-nest:jwt:${role}`).digest('hex') : '');
      if (!key) throw new Error(`Set JWT_ACCESS_SECRET (or ${SECRET_NAMES[role]}) before starting the server`);
      if ((own ?? base).length < MIN_SECRET_LENGTH) {
        const message = `The ${role} token secret is shorter than ${MIN_SECRET_LENGTH} characters`;
        if (config.get<string>('NODE_ENV') === 'production') throw new Error(message);
        this.log.warn(message);
      }
      this.keys.set(role, key);
    }
  }

  /** Ties a token to the account's current password. Changes whenever the password does. */
  private stamp(role: AuthUserType, passwordHash: string): string {
    return createHmac('sha256', this.keys.get(role)!).update(passwordHash).digest('hex').slice(0, 24);
  }

  /** Whether the token was issued for the account's current password. */
  matchesPassword(role: AuthUserType, payload: JwtPayload, passwordHash: string): boolean {
    return payload.pwd === this.stamp(role, passwordHash);
  }

  sign(role: AuthUserType, account: { id: number; passwordHash: string }): Promise<string> {
    const payload: JwtPayload = { sub: account.id, type: role, pwd: this.stamp(role, account.passwordHash) };
    return this.jwt.signAsync(payload, {
      secret: this.keys.get(role),
      algorithm: ALGORITHM,
      issuer: ISSUER,
      audience: role,
      expiresIn: this.lifetime,
      jwtid: randomUUID(),
    });
  }

  /** Verifies against one role's key. Returns the raw claims, or null when it does not verify. */
  private async open(role: AuthUserType, token: string): Promise<JwtPayload | null> {
    try {
      return await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.keys.get(role),
        algorithms: [ALGORITHM],
        issuer: ISSUER,
        audience: role,
      });
    } catch {
      return null;
    }
  }

  /**
   * The claims of a token valid for `role`. A token that does not verify is a 401. A genuine
   * token of another role (it verifies under that role's key) is a 403: signed by us, not allowed here.
   */
  async verify(role: AuthUserType, token: string): Promise<JwtPayload> {
    const payload = await this.open(role, token);
    if (!payload) {
      for (const other of Object.values(AuthUserType)) {
        if (other !== role && (await this.open(other, token))) throw new ForbiddenException('Insufficient permissions');
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (!Number.isSafeInteger(payload.sub) || payload.sub <= 0 || payload.type !== role || typeof payload.pwd !== 'string') {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return payload;
  }
}
