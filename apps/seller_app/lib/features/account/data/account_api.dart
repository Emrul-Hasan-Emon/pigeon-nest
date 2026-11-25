import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/api_client.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../shared/media/multipart_upload.dart';
import 'seller_profile.dart';

final profileProvider = FutureProvider.autoDispose<SellerProfile>((ref) async {
  final json = await ref.watch(apiClientProvider).get<Map<String, dynamic>>('/profile');
  return SellerProfile.fromJson(json);
});

final onboardingProvider = FutureProvider.autoDispose<Onboarding>((ref) async {
  final json = await ref.watch(apiClientProvider).get<Map<String, dynamic>>('/profile/onboarding');
  return Onboarding.fromJson(json);
});

final accountRepositoryProvider = Provider<AccountRepository>((ref) => AccountRepository(ref));

/// Every change to the seller's own account. Each call refreshes what the
/// rest of the app shows (shop name, access banner, checklist).
class AccountRepository {
  AccountRepository(this._ref);
  final Ref _ref;

  void _refresh(Map<String, dynamic> seller) {
    _ref.read(authProvider.notifier).applySeller(seller);
    _ref.invalidate(profileProvider);
    _ref.invalidate(onboardingProvider);
  }

  /// Only fields that are given are sent. Pictures go as files.
  Future<void> updateProfile({
    String? name,
    String? email,
    String? phone,
    String? description,
    XFile? avatar,
    XFile? nidFront,
    XFile? nidBack,
  }) async {
    final body = await buildMultipart(
      fields: {
        'name': ?name,
        'email': ?email,
        'phone': ?phone,
        'description': ?description,
      },
      singleFiles: {
        'avatar': ?avatar,
        'nidFrontImage': ?nidFront,
        'nidBackImage': ?nidBack,
      },
    );
    final seller = await _ref.read(apiClientProvider).patch<Map<String, dynamic>>('/profile', body: body);
    _refresh(seller);
  }

  /// Switch selling on or off. Dates are `yyyy-mm-dd`; both or neither.
  Future<void> setSelling({required bool enabled, String? breakStartsOn, String? breakEndsOn, String? note}) async {
    final seller = await _ref.read(apiClientProvider).patch<Map<String, dynamic>>('/profile/selling', body: {
      'isEnabledForSell': enabled,
      'breakStartsOn': breakStartsOn,
      'breakEndsOn': breakEndsOn,
      'note': note,
    });
    _refresh(seller);
  }

  /// The server returns a fresh token (old ones stop working), so keep it.
  Future<void> changePassword({required String current, required String next}) async {
    final data = await _ref.read(apiClientProvider).patch<Map<String, dynamic>>(
      '/profile/password',
      body: {'currentPassword': current, 'newPassword': next},
    );
    final token = data['accessToken'] as String?;
    if (token != null) await _ref.read(tokenStoreProvider).write(token);
  }
}
