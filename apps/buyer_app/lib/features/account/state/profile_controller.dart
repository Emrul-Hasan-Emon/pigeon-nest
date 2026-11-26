import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/auth/auth_controller.dart';
import '../data/account_api.dart';
import '../data/profile_model.dart';

final profileProvider = AsyncNotifierProvider<ProfileController, Profile>(ProfileController.new);

class ProfileController extends AsyncNotifier<Profile> {
  @override
  Future<Profile> build() async {
    final profile = await ref.read(accountApiProvider).getProfile();
    _syncAuthName(profile);
    return profile;
  }

  Future<void> reload() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final profile = await ref.read(accountApiProvider).getProfile();
      _syncAuthName(profile);
      return profile;
    });
  }

  Future<void> save({String? name, String? email, String? phone, XFile? avatar}) async {
    final profile = await ref.read(accountApiProvider).updateProfile(name: name, email: email, phone: phone, avatar: avatar);
    state = AsyncData(profile);
    _syncAuthName(profile);
  }

  Future<void> changePassword({required String currentPassword, required String newPassword}) {
    return ref.read(accountApiProvider).changePassword(currentPassword: currentPassword, newPassword: newPassword);
  }

  // Keeps the home shell's "Signed in as ..." and access banner in step
  // without it having to load the profile a second time.
  void _syncAuthName(Profile profile) {
    ref.read(authProvider.notifier).applyUser({'name': profile.name, 'access': {
      'canUse': profile.access.canUse,
      'code': profile.access.code,
      'reason': profile.access.reason,
    }});
  }
}
