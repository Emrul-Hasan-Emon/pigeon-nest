import '../../../core/auth/user_access.dart';
import '../../../core/config/app_config.dart';

/// Mirrors the server's `UserView` (`GET/PATCH /profile`).
class Profile {
  const Profile({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.avatarUrl,
    required this.emailVerified,
    required this.phoneVerified,
    required this.status,
    required this.suspensionReason,
    required this.access,
  });

  final int id;
  final String name;
  final String? email;
  final String? phone;
  final String? avatarUrl;
  final bool emailVerified;
  final bool phoneVerified;
  final String status;
  final String? suspensionReason;
  final UserAccess access;

  factory Profile.fromJson(Map<String, dynamic> json) {
    final avatar = json['avatarUrl'] as String?;
    return Profile(
      id: json['id'] as int,
      name: json['name'] as String,
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      avatarUrl: avatar == null ? null : AppConfig.mediaUrl(avatar),
      emailVerified: json['emailVerified'] as bool? ?? false,
      phoneVerified: json['phoneVerified'] as bool? ?? false,
      status: json['status'] as String? ?? 'active',
      suspensionReason: json['suspensionReason'] as String?,
      access: UserAccess.fromJson(json['access'] as Map<String, dynamic>?),
    );
  }
}
