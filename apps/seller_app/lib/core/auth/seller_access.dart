/// Mirrors the server's `SellerAccess` shape (`GET /profile`, login response),
/// the single source of truth for what the signed-in seller may do right now.
class SellerAccess {
  const SellerAccess({required this.canEditProfile, required this.canManage, this.code, this.reason});

  final bool canEditProfile;
  final bool canManage;
  final String? code;
  final String? reason;

  factory SellerAccess.full() => const SellerAccess(canEditProfile: true, canManage: true);

  factory SellerAccess.fromJson(Map<String, dynamic>? json) {
    if (json == null) return SellerAccess.full();
    return SellerAccess(
      canEditProfile: json['canEditProfile'] as bool? ?? true,
      canManage: json['canManage'] as bool? ?? true,
      code: json['code'] as String?,
      reason: json['reason'] as String?,
    );
  }
}
