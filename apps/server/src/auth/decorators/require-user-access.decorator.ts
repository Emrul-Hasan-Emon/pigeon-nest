import { SetMetadata } from '@nestjs/common';
import { UserAccessLevel } from '../policies/user-access.policy';

export const USER_ACCESS_KEY = 'userAccess';

// 'any'  any user, even suspended (read own profile)
// 'full' active users only (the default when omitted)
export const RequireUserAccess = (level: UserAccessLevel) =>
  SetMetadata(USER_ACCESS_KEY, level);
