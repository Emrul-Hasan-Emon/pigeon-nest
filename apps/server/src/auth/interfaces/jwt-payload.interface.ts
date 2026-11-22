import { AuthUserType } from '../../database/enums/auth-user-type.enum';

export interface JwtPayload {
  sub: number;
  type: AuthUserType;
  /** Ties the token to the account's password at sign-in. Present in verified tokens only. */
  pwd?: string;
}
