import { User } from '../../database/entities/person/user.entity';
import { UserStatus } from '../../database/enums/user-status.enum';

// 'any'  any user, even suspended (read own profile and status)
// 'full' active users only (the default when omitted)
export type UserAccessLevel = 'any' | 'full';

export type UserAccessCode = 'USER_SUSPENDED';

export interface UserAccess {
  // Everything except reading the own profile: edit profile, password, and
  // every future customer feature (cart, orders, ...).
  canUse: boolean;
  code: UserAccessCode | null;
  reason: string | null;
}

// The single source of truth for what a user may do:
//   active    -> everything
//   suspended -> can log in and view their profile, nothing else
export function getUserAccess(user: Pick<User, 'status'>): UserAccess {
  if (user.status === UserStatus.SUSPENDED) {
    return {
      canUse: false,
      code: 'USER_SUSPENDED',
      reason: 'Your account is suspended. Please contact support.',
    };
  }
  return { canUse: true, code: null, reason: null };
}
