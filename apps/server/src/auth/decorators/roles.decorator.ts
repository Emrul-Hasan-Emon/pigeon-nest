import { SetMetadata } from '@nestjs/common';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: AuthUserType[]) =>
  SetMetadata(ROLES_KEY, roles);
