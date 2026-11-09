import { AuthUserType } from '../../database/enums/auth-user-type.enum';

export interface JwtPayload {
  sub: number;
  type: AuthUserType;
}
