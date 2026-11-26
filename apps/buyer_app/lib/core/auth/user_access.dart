/// Mirrors the server's `UserAccess` shape (`GET /profile`, login response),
/// the single source of truth for what the signed-in buyer may do right now.
/// A suspended buyer can still sign in and read their own profile, but every
/// other call returns 403 `USER_SUSPENDED` — `canUse` is what the UI gates on.
class UserAccess {
  const UserAccess({required this.canUse, this.code, this.reason});

  final bool canUse;
  final String? code;
  final String? reason;

  factory UserAccess.full() => const UserAccess(canUse: true);

  factory UserAccess.fromJson(Map<String, dynamic>? json) {
    if (json == null) return UserAccess.full();
    return UserAccess(
      canUse: json['canUse'] as bool? ?? true,
      code: json['code'] as String?,
      reason: json['reason'] as String?,
    );
  }
}
