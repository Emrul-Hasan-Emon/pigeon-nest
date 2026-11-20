export type UserStatus = 'active' | 'suspended';

export type UserAccessCode = 'USER_SUSPENDED';

/** What a user may currently do; computed by the server. */
export interface UserAccess {
  canUse: boolean;
  code: UserAccessCode | null;
  reason: string | null;
}

export interface User {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  avatarPath: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  status: UserStatus;
  suspensionReason: string | null;
  createdBy: number | null;
  creatorType: string | null;
  creatorName: string | null;
  updatedBy: number | null;
  updaterType: string | null;
  updaterName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserListResponse {
  results: User[];
  nextCursor: number | null;
}

export interface UserListParams {
  search?: string;
  status?: UserStatus;
  cursor?: number;
  limit?: number;
}

/** One row of the append-only status log. Admin-only. */
export interface UserStatusHistoryEntry {
  id: number;
  userId: number;
  user: { id: number; name: string; phone: string | null; email: string | null } | null;
  fromStatus: UserStatus | null;
  toStatus: UserStatus;
  reason: string | null;
  createdBy: number | null;
  creatorType: 'admin' | 'seller' | 'user' | null;
  creatorName: string | null;
  createdAt: string;
}

export interface UserStatusHistoryParams {
  search?: string;
  userId?: number;
  fromStatus?: UserStatus;
  toStatus?: UserStatus;
  cursor?: number;
  limit?: number;
}

export interface UserStatusHistoryResponse {
  results: UserStatusHistoryEntry[];
  nextCursor: number | null;
}

/** A user as returned to the user themself (adds the access flags). */
export interface UserView extends User {
  access: UserAccess;
}

export interface UserLoginResponse {
  accessToken: string;
  user: UserView;
}
